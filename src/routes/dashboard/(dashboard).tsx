import { A, createAsync, useNavigate } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { logoutRequest, requireUserQuery } from "~/lib/auth";

// Permission check function
// Returns true if the user role has authorization to expand/view detailed records
const checkPermission = (role: string, _action: string): boolean => {
  if (role === "ADMIN" || role === "MANAGER" || role === "STAFF") {
    return true; // Authorized to expand apartment details & view records
  }
  return false;
};

// --- MOCK DATA FOR SECTIONS ---
const mockApartments = [
  { id: 101, code: "H0101", apartment: "Phòng 1203", head: "Nguyễn Văn An", phone: "0912345678", residents: 3, details: ["Vợ: Nguyễn Thị Lan (1990)", "Con: Nguyễn Văn Hùng (2015)"] },
  { id: 102, code: "H0102", apartment: "Phòng 1204", head: "Trần Thị Bình", phone: "0987654321", residents: 2, details: ["Chồng: Lê Văn Cường (1988)"] },
  { id: 103, code: "H0103", apartment: "Phòng 1205", head: "Phạm Văn Minh", phone: "0901122334", residents: 4, details: ["Bố: Phạm Văn Hùng (1955)", "Mẹ: Trần Thị Hoa (1960)", "Con: Phạm Minh Đức (2018)"] },
];

const mockOutstandingFees = [
  { id: 501, apartment: "Phòng 1203", type: "Phí dịch vụ", period: "Tháng 11/2026", amount: "500.000 đ", status: "Quá hạn" },
  { id: 502, apartment: "Phòng 1205", type: "Phí gửi xe", period: "Tháng 11/2026", amount: "300.000 đ", status: "Chưa đóng" },
];

const mockOpenDonations = [
  { id: 301, name: "Quỹ khuyến học 2026", purpose: "Hỗ trợ học bổng cho trẻ em trong tòa nhà", deadline: "30/11/2026", collected: "4.500.000 đ" },
  { id: 302, name: "Ủng hộ đồng bào lũ lụt", purpose: "Hỗ trợ các gia đình khó khăn", deadline: "15/12/2026", collected: "12.200.000 đ" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = createAsync(() => requireUserQuery());

  // State to track which apartment row is expanded
  const [expandedApartmentId, setExpandedApartmentId] = createSignal<number | null>(null);
  const [permissionError, setPermissionError] = createSignal<string | null>(null);
  const [loggingOut, setLoggingOut] = createSignal(false);

  // Toggle expansion with permission validation
  const toggleApartmentExpand = (role: string, id: number) => {
    const hasPermission = checkPermission(role, "expand_apartment_details");

    if (!hasPermission) {
      setPermissionError("Bạn không có quyền mở rộng thông tin chi tiết hộ gia đình này.");
      setTimeout(() => setPermissionError(null), 3500);
      return;
    }

    setPermissionError(null);
    setExpandedApartmentId(expandedApartmentId() === id ? null : id);
  };

  const handleLogout = async () => {
    if (loggingOut()) return;
    setLoggingOut(true);
    await logoutRequest();
    navigate("/login", { replace: true });
  };

  return (
    <Show when={user()}>
      {(currentUser) => (
        <div class="min-h-screen bg-gray-50 p-6 space-y-8">
          {/* HEADER SECTION */}
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div>
              <h1 class="text-2xl font-bold text-gray-800">Hệ Thống Quản Lý Chung Cư BlueMoon</h1>
              <p class="text-sm text-gray-500 mt-1">
                Xin chào, <span class="font-semibold text-indigo-600">{currentUser().name}</span> | Vai trò:{" "}
                <span class="inline-block bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">
                  {currentUser().role}
                </span>
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                Hệ thống đang hoạt động (R1 MVP)
              </span>
              <A
                href="/change-password"
                class="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
              >
                Đổi mật khẩu
              </A>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut()}
                class="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:cursor-not-allowed disabled:opacity-60 transition"
              >
                {loggingOut() ? "Đang đăng xuất..." : "Đăng xuất"}
              </button>
            </div>
          </div>

          {/* Permission error banner if user lacks rights to expand */}
          <Show when={permissionError()}>
            <div class="bg-red-50 border-l-4 border-red-400 p-4 rounded text-sm text-red-700 shadow-sm">
              {permissionError()}
            </div>
          </Show>

          {/* SECTION 1: APARTMENT / HOUSEHOLD MANAGEMENT (Expandable Rows) */}
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center justify-between">
              <span>Danh Sách Hộ Gia Đình & Cư Dân (dữ liệu minh họa)</span>
              <span class="text-xs font-normal text-gray-500">Kiểm tra quyền: {currentUser().role}</span>
            </h2>

            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <tr>
                    <th class="px-4 py-3">Mã hộ</th>
                    <th class="px-4 py-3">Căn hộ</th>
                    <th class="px-4 py-3">Chủ hộ</th>
                    <th class="px-4 py-3">Số điện thoại</th>
                    <th class="px-4 py-3 text-center">Thành viên</th>
                    <th class="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 text-sm">
                  <For each={mockApartments}>
                    {(item) => (
                      <>
                        <tr
                          class="hover:bg-gray-50 transition cursor-pointer"
                          onClick={() => toggleApartmentExpand(currentUser().role, item.id)}
                        >
                          <td class="px-4 py-3 font-medium text-indigo-600">{item.code}</td>
                          <td class="px-4 py-3 font-semibold text-gray-900">{item.apartment}</td>
                          <td class="px-4 py-3 text-gray-700">{item.head}</td>
                          <td class="px-4 py-3 text-gray-500">{item.phone}</td>
                          <td class="px-4 py-3 text-center">
                            <span class="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">
                              {item.residents} cư dân
                            </span>
                          </td>
                          <td class="px-4 py-3 text-right">
                            <button
                              type="button"
                              class="text-xs text-indigo-600 hover:underline font-medium"
                            >
                              {expandedApartmentId() === item.id ? "Thu gọn ▲" : "Chi tiết ▼"}
                            </button>
                          </td>
                        </tr>

                        {/* EXPANDABLE SUB-ROW CONTENT */}
                        <Show when={expandedApartmentId() === item.id}>
                          <tr class="bg-indigo-50/50">
                            <td colspan="6" class="px-6 py-4">
                              <div class="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                                Chi tiết thành viên sinh sống trong căn hộ:
                              </div>
                              <ul class="list-disc list-inside space-y-1 text-sm text-gray-700">
                                <For each={item.details}>
                                  {(detail) => <li>{detail}</li>}
                                </For>
                              </ul>
                            </td>
                          </tr>
                        </Show>
                      </>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>

          {/* TWO COLUMN GRID FOR FEES & DONATIONS */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SECTION 2: OUTSTANDING FEES */}
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 class="text-lg font-bold text-gray-800 mb-4">Khoản Phí Chưa Đóng / Quá Hạn</h2>
              <div class="space-y-3">
                <For each={mockOutstandingFees}>
                  {(fee) => (
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100">
                      <div>
                        <p class="text-sm font-semibold text-gray-800">
                          {fee.apartment} - {fee.type}
                        </p>
                        <p class="text-xs text-gray-500">Kỳ: {fee.period}</p>
                      </div>
                      <div class="text-right">
                        <span class="block text-sm font-bold text-red-600">{fee.amount}</span>
                        <span class="inline-block bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-medium mt-1">
                          {fee.status}
                        </span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* SECTION 3: CURRENT OPEN DONATIONS */}
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 class="text-lg font-bold text-gray-800 mb-4">Đợt Đóng Góp Đang Mở</h2>
              <div class="space-y-3">
                <For each={mockOpenDonations}>
                  {(donation) => (
                    <div class="p-3 bg-gray-50 rounded border border-gray-100">
                      <div class="flex justify-between items-start">
                        <p class="text-sm font-semibold text-gray-800">{donation.name}</p>
                        <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                          Đang thu
                        </span>
                      </div>
                      <p class="text-xs text-gray-500 mt-1">{donation.purpose}</p>
                      <div class="mt-3 flex justify-between items-center text-xs text-gray-600 border-t pt-2 border-gray-200">
                        <span>Hạn: {donation.deadline}</span>
                        <span class="font-bold text-indigo-600">Đã thu: {donation.collected}</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>

          {/* SECTION 4: REPORTS & STATISTICS VISUAL SUMMARY */}
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 class="text-lg font-bold text-gray-800 mb-4">Báo Cáo & Thống Kê Thu Phí (Tháng 11/2026)</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                <span class="text-xs text-indigo-600 font-medium uppercase">Tổng phải thu</span>
                <p class="text-xl font-bold text-indigo-900 mt-1">20.000.000 đ</p>
              </div>
              <div class="bg-green-50 p-4 rounded-lg border border-green-100">
                <span class="text-xs text-green-600 font-medium uppercase">Đã thu thực tế</span>
                <p class="text-xl font-bold text-green-900 mt-1">17.500.000 đ</p>
              </div>
              <div class="bg-amber-50 p-4 rounded-lg border border-amber-100">
                <span class="text-xs text-amber-600 font-medium uppercase">Tỷ lệ thu</span>
                <p class="text-xl font-bold text-amber-900 mt-1">87.5%</p>
              </div>
            </div>

            {/* Mock visual progress bar chart */}
            <div class="space-y-2">
              <div class="flex justify-between text-xs text-gray-600 font-medium">
                <span>Tiến độ hoàn thành thu phí kỳ này</span>
                <span>87.5%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-3">
                <div class="bg-indigo-600 h-3 rounded-full" style="width: 87.5%;"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
