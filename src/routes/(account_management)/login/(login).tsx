import { createAsync, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";
import PasswordField, { inputClass } from "~/components/PasswordField";
import {
  getCurrentUserQuery,
  invalidateAuthQueries,
  loginRequest,
} from "~/lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const currentUser = createAsync(() => getCurrentUserQuery());

  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  createEffect(() => {
    if (currentUser()) {
      navigate("/dashboard", { replace: true });
    }
  });

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (submitting()) return;

    const trimmedEmail = email().trim();
    const rawPassword = password();

    if (!trimmedEmail || !rawPassword) {
      setErrorMessage("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage("Định dạng email không hợp lệ.");
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    try {
      const result = await loginRequest(trimmedEmail, rawPassword);
      if (!result.ok) {
        setErrorMessage(
          result.body?.data?.message ?? "Email hoặc mật khẩu không chính xác.",
        );
        return;
      }

      await invalidateAuthQueries();
      navigate("/dashboard", { replace: true });
    } catch {
      setErrorMessage("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="min-h-[calc(100vh-3.5rem)] bg-gray-50 flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-100 p-8">
        <div class="mb-6 text-center">
          <h1 class="text-2xl font-bold text-gray-800">Đăng nhập</h1>
          <p class="mt-1.5 text-sm text-gray-500">
            Hệ Thống Quản Lý Chung Cư BlueMoon
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

        <form onSubmit={handleSubmit} class="space-y-5" noValidate>
          <div>
            <label
              for="login-email"
              class="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="name@bluemoon.com"
              value={email()}
              disabled={submitting()}
              required
              aria-invalid={errorMessage() ? "true" : undefined}
              class={inputClass}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </div>

          <PasswordField
            id="login-password"
            name="password"
            label="Mật khẩu"
            autocomplete="current-password"
            placeholder="Nhập mật khẩu"
            value={password()}
            disabled={submitting()}
            ariaInvalid={Boolean(errorMessage())}
            onInput={(value) => setPassword(value)}
          />

          <button
            type="submit"
            disabled={submitting()}
            class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {submitting() ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </main>
  );
}
