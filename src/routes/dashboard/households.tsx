import { A, createAsync, revalidate } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { requireUserQuery } from "~/lib/auth";
import { getHouseholdsQuery } from "~/lib/households";

type ApiResult<T> = { code: number; data: T & { message?: string } };

export default function HouseholdManagementPage() {
  const user = createAsync(() => requireUserQuery());
  const [creating, setCreating] = createSignal(false);
  const [showForm, setShowForm] = createSignal(false);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const [apartmentNumber, setApartmentNumber] = createSignal("");
  const [headName, setHeadName] = createSignal("");
  const [headPhone, setHeadPhone] = createSignal("");
  const [headBirthDate, setHeadBirthDate] = createSignal("");

  // Server function fetching households
  const households = createAsync(() => getHouseholdsQuery());

  const refreshHouseholds = async () => {
    setError("");
    try {
      await revalidate(["households"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi làm mới danh sách.");
    }
  };

  const createHousehold = async (event: SubmitEvent) => {
    event.preventDefault();
    if (creating()) return;
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/households", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: apartmentNumber(),
          headName: headName(),
          headPhone: headPhone(),
          headBirthDate: headBirthDate(),
        }),
      });
      const body = (await response.json()) as ApiResult<{ householdId?: string }>;
      if (!response.ok || body.code !== 1000) {
        throw new Error(body.data?.message || "Không thể thêm hộ gia đình.");
      }
      setNotice(body.data.message || "Đã thêm hộ gia đình thành công.");
      setApartmentNumber("");
      setHeadName("");
      setHeadPhone("");
      setHeadBirthDate("");
      setShowForm(false);
      await refreshHouseholds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi thêm hộ gia đình.");
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (value: string) => {
    if (!value) return "Chưa cập nhật";
    const parts = value.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  };

  return (
    <Show when={user()}>
      {(currentUser) => (
        <main class="min-h-screen bg-slate-50 p-4 sm:p-6">
          <div class="mx-auto max-w-6xl space-y-6">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <A href="/dashboard" class="text-sm text-indigo-600 hover:underline">← Quay lại Dashboard</A>
                <h1 class="mt-2 text-2xl font-bold text-slate-900">Quản lý hộ gia đình</h1>
                <p class="mt-1 text-sm text-slate-500">Xin chào {currentUser().name}. Tại đây bạn có thể thêm hộ mới và xem thông tin cư dân.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(!showForm())}
                class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                {showForm() ? "Đóng biểu mẫu" : "+ Thêm hộ gia đình"}
              </button>
            </div>
            <Show when={error()}>
              <div role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error()}</div>
            </Show>
            <Show when={notice()}>
              <div role="status" class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice()}</div>
            </Show>
            <Show when={showForm()}>
              <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 class="text-lg font-semibold text-slate-900">Thông tin hộ gia đình mới</h2>
                <p class="mt-1 text-sm text-slate-500">Hộ mới được tạo kèm một cư dân đầu tiên với vai trò chủ hộ.</p>
                <form onSubmit={createHousehold} class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label class="text-sm font-medium text-slate-700">
                    Số căn hộ <span class="text-red-600">*</span>
                    <input required maxLength={50} value={apartmentNumber()} onInput={(e) => setApartmentNumber(e.currentTarget.value)} placeholder="Ví dụ: 1206" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </label>
                  <label class="text-sm font-medium text-slate-700">
                    Họ tên chủ hộ <span class="text-red-600">*</span>
                    <input required maxLength={255} value={headName()} onInput={(e) => setHeadName(e.currentTarget.value)} placeholder="Nhập họ tên chủ hộ" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </label>
                  <label class="text-sm font-medium text-slate-700">
                    Số điện thoại
                    <input type="tel" maxLength={20} value={headPhone()} onInput={(e) => setHeadPhone(e.currentTarget.value)} placeholder="Ví dụ: 0912345678" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </label>
                  <label class="text-sm font-medium text-slate-700">
                    Ngày sinh chủ hộ <span class="text-red-600">*</span>
                    <input type="date" required max={new Date().toISOString().slice(0, 10)} value={headBirthDate()} onInput={(e) => setHeadBirthDate(e.currentTarget.value)} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </label>
                  <div class="flex flex-wrap items-center gap-3 sm:col-span-2">
                    <button type="submit" disabled={creating()} class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                      {creating() ? "Đang lưu..." : "Lưu hộ gia đình"}
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Hủy</button>
                  </div>
                </form>
              </section>
            </Show>
            <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 class="font-semibold text-slate-900">Danh sách hộ gia đình</h2>
                  <p class="mt-1 text-xs text-slate-500">{(households?.length ?? 0)} hộ trong cơ sở dữ liệu</p>
                </div>
                <button type="button" onClick={refreshHouseholds} class="text-sm font-medium text-indigo-600 hover:underline">Làm mới</button>
              </div>
              <Show when={!households.loading && households.error == null} fallback={<p class="px-5 py-8 text-center text-sm text-slate-500">Đang tải dữ liệu...</p>}>
                <Show when={households()?.length > 0} fallback={<p class="px-5 py-10 text-center text-sm text-slate-500">Chưa có hộ gia đình nào. Hãy chọn “Thêm hộ gia đình” để tạo hộ đầu tiên.</p>}>
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-slate-200 text-sm">
                      <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th class="px-4 py-3">Mã hộ</th>
                          <th class="px-4 py-3">Căn hộ</th>
                          <th class="px-4 py-3">Chủ hộ</th>
                          <th class="px-4 py-3">Số điện thoại</th>
                          <th class="px-4 py-3 text-center">Cư dân</th>
                          <th class="px-4 py-3 text-right">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100">
                        <For each={households() ?? []}>
                          {(household) => (
                            <>
                              <tr class="cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(expandedId() === household.id ? null : household.id)}>
                                <td class="whitespace-nowrap px-4 py-3 font-semibold text-indigo-600">H{household.number}</td>
                                <td class="whitespace-nowrap px-4 py-3 font-medium text-slate-900">Phòng {household.number}</td>
                                <td class="whitespace-nowrap px-4 py-3 text-slate-700">{household.head?.name ?? "Chưa có chủ hộ"}</td>
                                <td class="whitespace-nowrap px-4 py-3 text-slate-500">{household.head?.phoneNumber || "—"}</td>
                                <td class="px-4 py-3 text-center">{household.residents.length}</td>
                                <td class="whitespace-nowrap px-4 py-3 text-right text-indigo-600">{expandedId() === household.id ? "Thu gọn ▲" : "Xem ▼"}</td>
                              </tr>
                              <Show when={expandedId() === household.id}>
                                <tr class="bg-indigo-50/40">
                                  <td colspan="6" class="px-5 py-4">
                                    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                                      <h3 class="font-semibold text-slate-800">Thông tin cư dân – căn hộ {household.number}</h3>
                                      <span class={`rounded-full px-2.5 py-1 text-xs font-semibold ${household.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                                        {household.status === "ACTIVE" ? "Đang sử dụng" : "Còn trống"}
                                      </span>
                                    </div>
                                    <Show when={household.residents.length > 0} fallback={<p class="text-sm text-slate-500">Chưa có thông tin cư dân.</p>}>
                                      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <For each={household.residents}>
                                          {(resident) => (
                                            <div class="rounded-lg border border-indigo-100 bg-white p-3">
                                              <div class="flex items-start justify-between gap-2">
                                                <p class="font-semibold text-slate-800">{resident.name}</p>
                                                <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{resident.relationship}</span>
                                              </div>
                                              <p class="mt-2 text-xs text-slate-500">Điện thoại: {resident.phoneNumber || "Chưa cập nhật"}</p>
                                              <p class="mt-1 text-xs text-slate-500">Ngày sinh: {formatDate(resident.birthDate)}</p>
                                            </div>
                                          )}
                                        </For>
                                      </div>
                                    </Show>
                                  </td>
                                </tr>
                              </Show>
                            </>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
              </Show>
            </section>
          </div>
        </main>
      )}
    </Show>
  );
}
