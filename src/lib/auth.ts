import { query, redirect, revalidate } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { ErrorCodes, type ErrorCode } from "~/server/api/ErrorCode";
import { getDb } from "~/server/database/db";
import {
  buildClearedSessionCookieHeader,
  buildSessionCookieHeader,
  changeUserPassword,
  getSessionUser,
  isSameOriginRequest,
  loginUser,
  logoutSession,
  type SafeUser,
} from "~/server/service/auth";

export const CURRENT_USER_CACHE_KEY = "current-user";
export const REQUIRE_USER_CACHE_KEY = "require-user";

export interface ServerAuthResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  body: {
    code: ErrorCode;
    data: T & { message?: string };
  };
}

/**
 * Fetches the authenticated user for the current request (or null if unauthenticated).
 */
export const getCurrentUserQuery = query(async (): Promise<SafeUser | null> => {
  "use server";
  const event = getRequestEvent();
  if (!event) return null;
  try {
    const sql = getDb();
    const session = await getSessionUser(sql, event.request);
    return session ? session.user : null;
  } catch (error) {
    console.error(
      "getCurrentUserQuery error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return null;
  }
}, CURRENT_USER_CACHE_KEY);

/**
 * Guards protected pages on both SSR and client navigation, redirecting unauthenticated
 * requests to /login.
 */
export const requireUserQuery = query(async (): Promise<SafeUser> => {
  "use server";
  const event = getRequestEvent();
  if (!event) {
    throw redirect("/login");
  }

  let session = null;
  try {
    const sql = getDb();
    session = await getSessionUser(sql, event.request);
  } catch (error) {
    console.error(
      "requireUserQuery error:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  if (!session) {
    throw redirect("/login");
  }
  return session.user;
}, REQUIRE_USER_CACHE_KEY);

/**
 * Invalidates cached auth queries after login, logout, or password change.
 */
export async function invalidateAuthQueries(): Promise<void> {
  await revalidate([CURRENT_USER_CACHE_KEY, REQUIRE_USER_CACHE_KEY]);
}

/**
 * Server function: authenticates credentials directly against PostgreSQL and sets the HttpOnly session cookie.
 */
export async function loginServer(
  email: string,
  password: string,
): Promise<ServerAuthResult<{ user?: SafeUser }>> {
  "use server";
  const event = getRequestEvent();
  if (!event) {
    return {
      ok: false,
      status: 500,
      body: {
        code: ErrorCodes.SYSTEM_OR_DATABASE_ERROR,
        data: { message: "Không thể xử lý yêu cầu đăng nhập." },
      },
    };
  }

  if (!isSameOriginRequest(event.request)) {
    return {
      ok: false,
      status: 403,
      body: { code: ErrorCodes.FORBIDDEN, data: { message: "Yêu cầu không hợp lệ." } },
    };
  }

  try {
    const sql = getDb();
    const result = await loginUser(
      sql,
      typeof email === "string" ? email : "",
      typeof password === "string" ? password : "",
    );

    event.response.headers.set("Cache-Control", "no-store");

    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        body: { code: result.code, data: { message: result.message } },
      };
    }

    event.response.headers.append(
      "Set-Cookie",
      buildSessionCookieHeader(result.data.rawToken),
    );

    return {
      ok: true,
      status: 200,
      body: { code: ErrorCodes.SUCCESS, data: { user: result.data.user } },
    };
  } catch (error) {
    console.error(
      "Login server function error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return {
      ok: false,
      status: 500,
      body: {
        code: ErrorCodes.SYSTEM_OR_DATABASE_ERROR,
        data: { message: "Lỗi hệ thống khi đăng nhập. Vui lòng thử lại sau." },
      },
    };
  }
}

/**
 * Server function: deletes the current session in PostgreSQL and expires the session cookie.
 */
export async function logoutServer(): Promise<boolean> {
  "use server";
  const event = getRequestEvent();
  if (!event) return false;

  if (!isSameOriginRequest(event.request)) {
    return false;
  }

  try {
    const sql = getDb();
    await logoutSession(sql, event.request);
    event.response.headers.set("Cache-Control", "no-store");
    event.response.headers.append("Set-Cookie", buildClearedSessionCookieHeader());
    return true;
  } catch (error) {
    console.error(
      "Logout server function error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    event.response.headers.set("Cache-Control", "no-store");
    event.response.headers.append("Set-Cookie", buildClearedSessionCookieHeader());
    return false;
  }
}

/**
 * Server function: verifies current password, updates hash in PostgreSQL, and rotates session cookie.
 */
export async function changePasswordServer(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ServerAuthResult> {
  "use server";
  const event = getRequestEvent();
  if (!event) {
    return {
      ok: false,
      status: 500,
      body: {
        code: ErrorCodes.SYSTEM_OR_DATABASE_ERROR,
        data: { message: "Không thể xử lý yêu cầu đổi mật khẩu." },
      },
    };
  }

  if (!isSameOriginRequest(event.request)) {
    return {
      ok: false,
      status: 403,
      body: { code: ErrorCodes.FORBIDDEN, data: { message: "Yêu cầu không hợp lệ." } },
    };
  }

  try {
    const sql = getDb();
    const session = await getSessionUser(sql, event.request);
    event.response.headers.set("Cache-Control", "no-store");

    if (!session) {
      return {
        ok: false,
        status: 401,
        body: {
          code: ErrorCodes.UNAUTHENTICATED,
          data: { message: "Vui lòng đăng nhập để đổi mật khẩu." },
        },
      };
    }

    const result = await changeUserPassword(sql, {
      userId: session.user.id,
      currentPassword:
        typeof payload?.currentPassword === "string" ? payload.currentPassword : "",
      newPassword: typeof payload?.newPassword === "string" ? payload.newPassword : "",
      confirmPassword:
        typeof payload?.confirmPassword === "string" ? payload.confirmPassword : "",
    });

    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        body: { code: result.code, data: { message: result.message } },
      };
    }

    event.response.headers.append(
      "Set-Cookie",
      buildSessionCookieHeader(result.data.rawToken),
    );

    return {
      ok: true,
      status: 200,
      body: {
        code: ErrorCodes.SUCCESS,
        data: { message: "Đổi mật khẩu thành công." },
      },
    };
  } catch (error) {
    console.error(
      "Change password server function error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return {
      ok: false,
      status: 500,
      body: {
        code: ErrorCodes.SYSTEM_OR_DATABASE_ERROR,
        data: { message: "Lỗi hệ thống khi đổi mật khẩu. Vui lòng thử lại sau." },
      },
    };
  }
}

/**
 * Client helper: invokes loginServer.
 */
export async function loginRequest(
  email: string,
  password: string,
): Promise<ServerAuthResult<{ user?: SafeUser }>> {
  return loginServer(email, password);
}

/**
 * Client helper: invokes logoutServer and invalidates cached auth queries.
 */
export async function logoutRequest(): Promise<boolean> {
  try {
    const ok = await logoutServer();
    await invalidateAuthQueries();
    return ok;
  } catch {
    await invalidateAuthQueries();
    return false;
  }
}

/**
 * Client helper: invokes changePasswordServer.
 */
export async function changePasswordRequest(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ServerAuthResult> {
  return changePasswordServer(payload);
}
