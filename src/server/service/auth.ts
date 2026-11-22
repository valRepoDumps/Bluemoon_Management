import crypto from "node:crypto";
import type postgres from "postgres";
import { ErrorCodes, type ErrorCode } from "~/server/api/ErrorCode";
import type { Tx } from "~/server/database/seed-database-table";
import { hashPassword, verifyPassword } from "~/server/service/password-hash";
import { validatePasswordPolicy } from "~/server/service/password-policy";
import { generateUUID, type UUID } from "~/types/UUID";
import type { UserRole } from "~/types/User";

export const SESSION_COOKIE_NAME = "bluemoon_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

// Precomputed valid bcrypt hash used to equalize response timing when an email is not found.
const DUMMY_BCRYPT_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export interface SafeUser {
  id: UUID;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthenticatedSession {
  sessionId: UUID;
  user: SafeUser;
}

export type AuthActionResult<T = Record<string, never>> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; status: number; message: string };

/**
 * Hashes a raw session token with SHA-256 before storing or querying in PostgreSQL.
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generates a cryptographically secure random session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Parses the session cookie from an incoming Request.
 */
export function parseSessionTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) continue;
    const name = pair.slice(0, eqIndex).trim();
    if (name === SESSION_COOKIE_NAME) {
      const value = pair.slice(eqIndex + 1).trim();
      if (!/^[a-f0-9]{64}$/i.test(value)) {
        return null;
      }
      return value;
    }
  }
  return null;
}

/**
 * Builds an HttpOnly Set-Cookie header value for an active session.
 */
export function buildSessionCookieHeader(
  rawToken: string,
  maxAgeSeconds = SESSION_TTL_SECONDS,
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${rawToken}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/**
 * Builds an expired Set-Cookie header value to clear the session cookie.
 */
export function buildClearedSessionCookieHeader(): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/**
 * Basic CSRF check for state-changing API requests:
 * verifies Origin (or Referer) matches the target Host when provided by the browser.
 */
export function isSameOriginRequest(request: Request): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return true;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Authenticates a user by email and password and creates a new database session.
 */
export async function loginUser(
  sql: Tx,
  email: string,
  password: string,
): Promise<AuthActionResult<{ user: SafeUser; rawToken: string; expiresAt: string }>> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return {
      ok: false,
      code: ErrorCodes.VALIDATION_ERROR,
      status: 400,
      message: "Vui lòng nhập đầy đủ email và mật khẩu.",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return {
      ok: false,
      code: ErrorCodes.VALIDATION_ERROR,
      status: 400,
      message: "Định dạng email không hợp lệ.",
    };
  }

  const rows = await sql<
    Array<{
      id: UUID;
      email: string;
      password_hash: string;
      name: string;
      role: UserRole;
    }>
  >`
    SELECT id, email, password_hash, name, role
    FROM users
    WHERE LOWER(email) = ${normalizedEmail}
      AND deleted_at IS NULL
    LIMIT 1
  `;

  const userRow = rows[0];
  const passwordMatches = await verifyPassword(
    password,
    userRow ? userRow.password_hash : DUMMY_BCRYPT_HASH,
  );

  if (!userRow || !passwordMatches) {
    return {
      ok: false,
      code: ErrorCodes.INVALID_CREDENTIALS,
      status: 401,
      message: "Email hoặc mật khẩu không chính xác.",
    };
  }

  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const sessionId = generateUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await sql`
    INSERT INTO sessions (id, user_id, token, created_at, expires_at)
    VALUES (${sessionId}, ${userRow.id}, ${tokenHash}, ${now.toISOString()}, ${expiresAt.toISOString()})
  `;

  return {
    ok: true,
    data: {
      user: {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        role: userRow.role,
      },
      rawToken,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

/**
 * Resolves the currently authenticated user from the session cookie, or returns null.
 */
export async function getSessionUser(
  sql: Tx,
  request: Request,
): Promise<AuthenticatedSession | null> {
  const rawToken = parseSessionTokenFromRequest(request);
  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const rows = await sql<
    Array<{
      session_id: UUID;
      id: UUID;
      email: string;
      name: string;
      role: UserRole;
    }>
  >`
    SELECT s.id AS session_id, u.id, u.email, u.name, u.role
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token = ${tokenHash}
      AND s.expires_at > NOW()
      AND u.deleted_at IS NULL
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    sessionId: row.session_id,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
    },
  };
}

/**
 * Deletes the current session from PostgreSQL if present.
 */
export async function logoutSession(sql: Tx, request: Request): Promise<void> {
  const rawToken = parseSessionTokenFromRequest(request);
  if (!rawToken) return;

  const tokenHash = hashSessionToken(rawToken);
  await sql`
    DELETE FROM sessions
    WHERE token = ${tokenHash}
  `;
}

/**
 * Verifies the current password, enforces password policy, updates the password hash,
 * invalidates all previous sessions for the user, and issues a fresh session.
 */
export async function changeUserPassword(
  sql: postgres.Sql,
  params: {
    userId: UUID;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
): Promise<AuthActionResult<{ rawToken: string; expiresAt: string }>> {
  const { userId, currentPassword, newPassword, confirmPassword } = params;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return {
      ok: false,
      code: ErrorCodes.VALIDATION_ERROR,
      status: 400,
      message: "Vui lòng điền đầy đủ tất cả các trường mật khẩu.",
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      ok: false,
      code: ErrorCodes.VALIDATION_ERROR,
      status: 400,
      message: "Xác nhận mật khẩu mới không khớp.",
    };
  }

  if (newPassword === currentPassword) {
    return {
      ok: false,
      code: ErrorCodes.BUSINESS_RULE_VIOLATION,
      status: 400,
      message: "Mật khẩu mới phải khác mật khẩu hiện tại.",
    };
  }

  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    return {
      ok: false,
      code: ErrorCodes.VALIDATION_ERROR,
      status: 400,
      message: policy.error ?? "Mật khẩu mới không đáp ứng yêu cầu bảo mật.",
    };
  }

  const userRows = await sql<Array<{ id: UUID; password_hash: string }>>`
    SELECT id, password_hash
    FROM users
    WHERE id = ${userId}
      AND deleted_at IS NULL
    LIMIT 1
  `;

  const userRow = userRows[0];
  if (!userRow) {
    return {
      ok: false,
      code: ErrorCodes.UNAUTHENTICATED,
      status: 401,
      message: "Phiên đăng nhập không hợp lệ.",
    };
  }

  const currentValid = await verifyPassword(currentPassword, userRow.password_hash);
  if (!currentValid) {
    return {
      ok: false,
      code: ErrorCodes.INVALID_CREDENTIALS,
      status: 401,
      message: "Mật khẩu hiện tại không chính xác.",
    };
  }

  const newHash = await hashPassword(newPassword);
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const newSessionId = generateUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await sql.begin(async (tx) => {
    await tx`
      UPDATE users
      SET password_hash = ${newHash},
          updated_at = ${now.toISOString()}
      WHERE id = ${userId}
        AND deleted_at IS NULL
    `;

    // Invalidate all existing sessions for this user, then create a fresh rotated session.
    await tx`
      DELETE FROM sessions
      WHERE user_id = ${userId}
    `;

    await tx`
      INSERT INTO sessions (id, user_id, token, created_at, expires_at)
      VALUES (${newSessionId}, ${userId}, ${tokenHash}, ${now.toISOString()}, ${expiresAt.toISOString()})
    `;
  });

  return {
    ok: true,
    data: {
      rawToken,
      expiresAt: expiresAt.toISOString(),
    },
  };
}
