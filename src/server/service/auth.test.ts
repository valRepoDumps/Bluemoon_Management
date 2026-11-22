import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import { ErrorCodes } from "~/server/api/ErrorCode";
import type { UserDB } from "~/server/database/DatabaseProp";
import { seedSessions, seedUsers } from "~/server/database/seed-database-table";
import {
  buildClearedSessionCookieHeader,
  buildSessionCookieHeader,
  changeUserPassword,
  getSessionUser,
  isSameOriginRequest,
  loginUser,
  logoutSession,
  SESSION_COOKIE_NAME,
} from "./auth";
import { hashPassword } from "./password-hash";
import { validatePasswordPolicy } from "./password-policy";
import { UserRole } from "~/types/User";
import { generateUUID } from "~/types/UUID";

describe("validatePasswordPolicy", () => {
  it("rejects empty or whitespace-only passwords", () => {
    expect(validatePasswordPolicy("").valid).toBe(false);
    expect(validatePasswordPolicy("        ").valid).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(validatePasswordPolicy("Abc123").valid).toBe(false);
  });

  it("rejects passwords exceeding 72 UTF-8 bytes", () => {
    expect(validatePasswordPolicy("a1".repeat(37)).valid).toBe(false);
  });

  it("rejects passwords missing letters or digits", () => {
    expect(validatePasswordPolicy("12345678").valid).toBe(false);
    expect(validatePasswordPolicy("abcdefgh").valid).toBe(false);
  });

  it("accepts a strong password", () => {
    expect(validatePasswordPolicy("BlueMoon2026").valid).toBe(true);
  });
});

describe("isSameOriginRequest", () => {
  it("allows matching Origin and Host", () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    expect(isSameOriginRequest(req)).toBe(true);
  });

  it("rejects mismatched Origin and Host", () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil.example.com",
      },
    });
    expect(isSameOriginRequest(req)).toBe(false);
  });
});

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe.skipIf(!url)("auth service (PostgreSQL integration)", () => {
  const schema = `test_auth_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;

  const activeUserId = generateUUID();
  const deletedUserId = generateUUID();
  const activeEmail = "nv.huong@bluemoon.com";
  const initialPassword = "Huong2000";

  beforeAll(async () => {
    admin = postgres(url!, { max: 1 });
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    sql = postgres(url!, { max: 1, connection: { search_path: schema } });

    const now = "2026-11-22T00:00:00Z";
    const activeHash = await hashPassword(initialPassword);
    const deletedHash = await hashPassword("Deleted2026");

    const users: UserDB[] = [
      {
        id: activeUserId,
        email: activeEmail,
        passwordHash: activeHash,
        name: "Nguyễn Thị Hương",
        role: UserRole.STAFF,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: deletedUserId,
        email: "deleted@bluemoon.com",
        passwordHash: deletedHash,
        name: "Deleted User",
        role: UserRole.STAFF,
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      },
    ];

    await sql.begin(async (tx) => {
      await seedUsers(tx, users);
      await seedSessions(tx, []);
    });
  });

  beforeEach(async () => {
    await sql`DELETE FROM sessions`;
    const activeHash = await hashPassword(initialPassword);
    await sql`
      UPDATE users
      SET password_hash = ${activeHash}
      WHERE id = ${activeUserId}
    `;
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin?.end();
  });

  describe("loginUser", () => {
    it("authenticates valid credentials and creates a session without exposing passwordHash", async () => {
      const result = await loginUser(sql, "  NV.HUONG@bluemoon.com ", initialPassword);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.user.email).toBe(activeEmail);
      expect(result.data.user.role).toBe(UserRole.STAFF);
      expect("passwordHash" in result.data.user).toBe(false);
      expect(result.data.rawToken).toMatch(/^[a-f0-9]{64}$/);

      const sessionReq = new Request("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${result.data.rawToken}` },
      });
      const session = await getSessionUser(sql, sessionReq);
      expect(session?.user.id).toBe(activeUserId);
    });

    it("rejects incorrect password", async () => {
      const result = await loginUser(sql, activeEmail, "WrongPassword1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
        expect(result.status).toBe(401);
      }
    });

    it("rejects unknown email and soft-deleted accounts", async () => {
      const unknown = await loginUser(sql, "nobody@bluemoon.com", initialPassword);
      expect(unknown.ok).toBe(false);

      const deleted = await loginUser(sql, "deleted@bluemoon.com", "Deleted2026");
      expect(deleted.ok).toBe(false);
    });

    it("rejects empty fields and invalid email format", async () => {
      const empty = await loginUser(sql, "", "");
      expect(empty.ok).toBe(false);
      if (!empty.ok) expect(empty.code).toBe(ErrorCodes.VALIDATION_ERROR);

      const invalidEmail = await loginUser(sql, "not-an-email", initialPassword);
      expect(invalidEmail.ok).toBe(false);
      if (!invalidEmail.ok) expect(invalidEmail.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });
  });

  describe("logoutSession & getSessionUser", () => {
    it("invalidates session on logout and clears cookie", async () => {
      const login = await loginUser(sql, activeEmail, initialPassword);
      expect(login.ok).toBe(true);
      if (!login.ok) return;

      const req = new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${login.data.rawToken}` },
      });

      expect(await getSessionUser(sql, req)).not.toBeNull();
      await logoutSession(sql, req);
      expect(await getSessionUser(sql, req)).toBeNull();

      const clearedCookie = buildClearedSessionCookieHeader();
      expect(clearedCookie).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(clearedCookie).toContain("Max-Age=0");
      expect(clearedCookie).toContain("HttpOnly");
    });

    it("rejects expired sessions", async () => {
      const login = await loginUser(sql, activeEmail, initialPassword);
      expect(login.ok).toBe(true);
      if (!login.ok) return;

      await sql`
        UPDATE sessions
        SET expires_at = NOW() - INTERVAL '1 hour'
        WHERE user_id = ${activeUserId}
      `;

      const req = new Request("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${login.data.rawToken}` },
      });
      expect(await getSessionUser(sql, req)).toBeNull();
    });

    it("builds HttpOnly session cookies", () => {
      const cookie = buildSessionCookieHeader("a".repeat(64));
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
    });
  });

  describe("changeUserPassword", () => {
    it("rejects incorrect current password", async () => {
      const res = await changeUserPassword(sql, {
        userId: activeUserId,
        currentPassword: "WrongCurrent1",
        newPassword: "NewPassword123",
        confirmPassword: "NewPassword123",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
    });

    it("rejects empty fields, mismatched confirmation, weak password, and unchanged password", async () => {
      const empty = await changeUserPassword(sql, {
        userId: activeUserId,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      expect(empty.ok).toBe(false);

      const mismatch = await changeUserPassword(sql, {
        userId: activeUserId,
        currentPassword: initialPassword,
        newPassword: "NewPassword123",
        confirmPassword: "DifferentPassword123",
      });
      expect(mismatch.ok).toBe(false);

      const weak = await changeUserPassword(sql, {
        userId: activeUserId,
        currentPassword: initialPassword,
        newPassword: "short",
        confirmPassword: "short",
      });
      expect(weak.ok).toBe(false);

      const unchanged = await changeUserPassword(sql, {
        userId: activeUserId,
        currentPassword: initialPassword,
        newPassword: initialPassword,
        confirmPassword: initialPassword,
      });
      expect(unchanged.ok).toBe(false);
      if (!unchanged.ok) expect(unchanged.code).toBe(ErrorCodes.BUSINESS_RULE_VIOLATION);
    });

    it("updates password, rotates session, and rejects old password afterwards", async () => {
      const login = await loginUser(sql, activeEmail, initialPassword);
      expect(login.ok).toBe(true);
      if (!login.ok) return;

      const oldToken = login.data.rawToken;
      const newPassword = "NewBlueMoon2026";

      const changed = await changeUserPassword(sql, {
        userId: activeUserId,
        currentPassword: initialPassword,
        newPassword,
        confirmPassword: newPassword,
      });
      expect(changed.ok).toBe(true);
      if (!changed.ok) return;

      // Old session must be invalidated
      const oldReq = new Request("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${oldToken}` },
      });
      expect(await getSessionUser(sql, oldReq)).toBeNull();

      // Rotated session must be valid
      const newReq = new Request("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${changed.data.rawToken}` },
      });
      expect((await getSessionUser(sql, newReq))?.user.id).toBe(activeUserId);

      // Old password rejected, new password accepted
      expect((await loginUser(sql, activeEmail, initialPassword)).ok).toBe(false);
      expect((await loginUser(sql, activeEmail, newPassword)).ok).toBe(true);
    });
  });
});
