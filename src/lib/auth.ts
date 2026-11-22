import { query, redirect, revalidate } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { ErrorCodes } from "~/server/api/ErrorCode";
import { getDb } from "~/server/database/db";
import { getSessionUser, type SafeUser } from "~/server/service/auth";

export const CURRENT_USER_CACHE_KEY = "current-user";
export const REQUIRE_USER_CACHE_KEY = "require-user";

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

export interface ApiJsonResult<T = Record<string, unknown>> {
  code: number;
  data: T & { message?: string };
}

/**
 * Submits credentials to POST /api/auth/login.
 */
export async function loginRequest(
  email: string,
  password: string,
): Promise<{ ok: boolean; status: number; body: ApiJsonResult<{ user?: SafeUser }> }> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as ApiJsonResult<{ user?: SafeUser }>;
  return {
    ok: response.ok && body.code === ErrorCodes.SUCCESS,
    status: response.status,
    body,
  };
}

/**
 * Calls POST /api/auth/logout and clears cached auth state.
 */
export async function logoutRequest(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    await invalidateAuthQueries();
    return response.ok;
  } catch {
    await invalidateAuthQueries();
    return false;
  }
}

/**
 * Submits a password change request to POST /api/auth/change-password.
 */
export async function changePasswordRequest(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; status: number; body: ApiJsonResult }> {
  const response = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as ApiJsonResult;
  return {
    ok: response.ok && body.code === ErrorCodes.SUCCESS,
    status: response.status,
    body,
  };
}
