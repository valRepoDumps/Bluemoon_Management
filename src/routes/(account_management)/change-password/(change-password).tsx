import { A, createAsync, useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import PasswordField from "~/components/PasswordField";
import {
  changePasswordRequest,
  invalidateAuthQueries,
  requireUserQuery,
} from "~/lib/auth";
import {
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "~/server/service/password-policy";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const user = createAsync(() => requireUserQuery());

  const [currentPassword, setCurrentPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (submitting()) return;

    const current = currentPassword();
    const next = newPassword();
    const confirm = confirmPassword();

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!current || !next || !confirm) {
      setErrorMessage("Vui lòng điền đầy đủ tất cả các trường mật khẩu.");
      return;
    }

    if (next !== confirm) {
      setErrorMessage("Xác nhận mật khẩu mới không khớp.");
      return;
    }

    if (next === current) {
      setErrorMessage("Mật khẩu mới phải khác mật khẩu hiện tại.");
      return;
    }

    const policy = validatePasswordPolicy(next);
    if (!policy.valid) {
      setErrorMessage(
        policy.error ?? "Mật khẩu mới không đáp ứng yêu cầu bảo mật.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const result = await changePasswordRequest({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });

      if (!result.ok) {
        if (result.status === 401 && result.body?.code === 1003) {
          await invalidateAuthQueries();
          navigate("/login", { replace: true });
          return;
        }
        setErrorMessage(
          result.body?.data?.message ?? "Không thể đổi mật khẩu. Vui lòng kiểm tra lại.",
        );
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage(
        result.body?.data?.message ?? "Đổi mật khẩu thành công.",
      );
    } catch {
      setErrorMessage("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Show when={user()}>
      {(currentUser) => (
        <main class="min-h-[calc(100vh-3.5rem)] bg-gray-50 flex items-center justify-center px-4 py-12">
          <div class="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-100 p-8">
            <div class="mb-6">
              <div class="flex items-center justify-between">
                <h1 class="text-2xl font-bold text-gray-800">Đổi mật khẩu</h1>
                <A
                  href="/dashboard"
                  class="text-xs font-medium text-indigo-600 hover:underline"
                >
                  ← Bảng điều khiển
                </A>
              </div>
              <p class="mt-1.5 text-sm text-gray-500">
                Tài khoản:{" "}
                <span class="font-medium text-gray-700">
                  {currentUser().email}
                </span>
              </p>
            </div>

            <Show when={errorMessage()}>
              <div
                role="alert"
                aria-live="polite"
                class="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
              >
                {errorMessage()}
              </div>
            </Show>

            <Show when={successMessage()}>
              <div
                role="status"
                aria-live="polite"
                class="mb-5 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
              >
                {successMessage()}
              </div>
            </Show>

            <form onSubmit={handleSubmit} class="space-y-5" noValidate>
              <PasswordField
                id="current-password"
                name="currentPassword"
                label="Mật khẩu hiện tại"
                autocomplete="current-password"
                placeholder="Nhập mật khẩu hiện tại"
                value={currentPassword()}
                disabled={submitting()}
                onInput={(value) => setCurrentPassword(value)}
              />

              <div>
                <PasswordField
                  id="new-password"
                  name="newPassword"
                  label="Mật khẩu mới"
                  autocomplete="new-password"
                  placeholder="Nhập mật khẩu mới"
                  value={newPassword()}
                  disabled={submitting()}
                  ariaDescribedBy="password-policy-hint"
                  onInput={(value) => setNewPassword(value)}
                />
                <p id="password-policy-hint" class="mt-1.5 text-xs text-slate-500">
                  Tối thiểu {PASSWORD_MIN_LENGTH} ký tự, gồm cả chữ cái và chữ số (tối đa 72 byte).
                </p>
              </div>

              <PasswordField
                id="confirm-password"
                name="confirmPassword"
                label="Xác nhận mật khẩu mới"
                autocomplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword()}
                disabled={submitting()}
                onInput={(value) => setConfirmPassword(value)}
              />

              <button
                type="submit"
                disabled={submitting()}
                class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition"
              >
                {submitting() ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
              </button>
            </form>
          </div>
        </main>
      )}
    </Show>
  );
}
