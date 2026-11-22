import { A, createAsync, useLocation, useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { getCurrentUserQuery, logoutRequest } from "~/lib/auth";

export default function Nav() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = createAsync(() => getCurrentUserQuery());
  const [loggingOut, setLoggingOut] = createSignal(false);

  const active = (path: string) =>
    path == location.pathname ? "border-sky-600" : "border-transparent hover:border-sky-600";

  const handleLogout = async () => {
    if (loggingOut()) return;
    setLoggingOut(true);
    await logoutRequest();
    setLoggingOut(false);
    navigate("/login", { replace: true });
  };

  return (
    <nav class="bg-sky-800">
      <div class="container mx-auto flex flex-wrap items-center justify-between p-3 text-gray-200">
        <ul class="flex items-center">
          <li class={`border-b-2 ${active("/")} mx-1.5 sm:mx-6`}>
            <A href="/">Home</A>
          </li>
          <li class={`border-b-2 ${active("/about")} mx-1.5 sm:mx-6`}>
            <A href="/about">About</A>
          </li>
          <Show when={user()}>
            <li class={`border-b-2 ${active("/dashboard")} mx-1.5 sm:mx-6`}>
              <A href="/dashboard">Dashboard</A>
            </li>
            <li class={`border-b-2 ${active("/change-password")} mx-1.5 sm:mx-6`}>
              <A href="/change-password">Đổi mật khẩu</A>
            </li>
          </Show>
        </ul>

        <div class="flex items-center gap-3 text-sm">
          <Show
            when={user()}
            fallback={
              <A
                href="/login"
                class={`border-b-2 ${active("/login")} mx-1.5 sm:mx-4`}
              >
                Đăng nhập
              </A>
            }
          >
            {(currentUser) => (
              <>
                <span class="hidden sm:inline text-xs text-sky-200">
                  {currentUser().name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut()}
                  class="rounded bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60 transition"
                >
                  {loggingOut() ? "Đang xuất..." : "Đăng xuất"}
                </button>
              </>
            )}
          </Show>
        </div>
      </div>
    </nav>
  );
}
