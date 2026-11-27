import type { APIEvent } from "@solidjs/start/server";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "~/server/api/ErrorCode";
import * as dbModule from "~/server/database/db";
import type { HouseholdDB, ResidentDB, SessionDB, UserDB } from "~/server/database/DatabaseProp";
import {
  seedHouseholds,
  seedResidents,
  seedSessions,
  seedUsers,
} from "~/server/database/seed-database-table";
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "~/server/service/auth";
import { HouseholdStatus } from "~/types/Household";
import { UserRole } from "~/types/User";
import { generateUUID, isUUID } from "~/types/UUID";
import { POST } from "./households";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe.skipIf(!url)("POST /api/households (PostgreSQL integration)", () => {
  const schema = `test_api_households_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;

  const userId = generateUUID();
  const rawToken = generateSessionToken();
  const existingHouseholdId = generateUUID();
  const existingHeadId = generateUUID();

  const buildPostRequest = (
    payload: Record<string, unknown>,
    options: {
      authenticated?: boolean;
      origin?: string;
      host?: string;
    } = {},
  ) => {
    const {
      authenticated = true,
      origin = "http://localhost:3000",
      host = "localhost:3000",
    } = options;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      host,
      origin,
    };
    if (authenticated) {
      headers.cookie = `${SESSION_COOKIE_NAME}=${rawToken}`;
    }

    return new Request("http://localhost:3000/api/households", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  };

  beforeAll(async () => {
    admin = postgres(url!, { max: 1 });
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    sql = postgres(url!, { max: 1, connection: { search_path: schema } });

    vi.spyOn(dbModule, "getDb").mockImplementation(() => sql);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

    const users: UserDB[] = [
      {
        id: userId,
        email: "staff.api@bluemoon.com",
        passwordHash: "unused-in-session-test",
        name: "Nhân viên API",
        role: UserRole.STAFF,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        deletedAt: null,
      },
    ];

    const sessions: SessionDB[] = [
      {
        id: generateUUID(),
        userId,
        token: hashSessionToken(rawToken),
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    ];

    const households: HouseholdDB[] = [
      {
        id: existingHouseholdId,
        headId: existingHeadId,
        number: 101,
        status: HouseholdStatus.ACTIVE,
      },
    ];

    const residents: ResidentDB[] = [
      {
        id: existingHeadId,
        householdId: existingHouseholdId,
        name: "Chủ hộ Có Sẵn",
        phoneNumber: "0912345678",
        birthDate: "1980-05-10",
        relationship: "Chủ hộ",
      },
    ];

    await sql.begin(async (tx) => {
      await seedUsers(tx, users);
      await seedSessions(tx, sessions);
      await seedHouseholds(tx, households);
      await seedResidents(tx, residents);
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await sql?.end();
    await admin?.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin?.end();
  });

  it("creates a new household and its head resident in PostgreSQL and returns 201", async () => {
    const request = buildPostRequest({
      number: "501",
      headName: "Lê Văn Cường",
      headPhone: "0909123456",
      headBirthDate: "1992-08-15",
    });

    const response = await POST({ request } as APIEvent);
    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      code: number;
      data: { householdId?: string; message?: string };
    };
    expect(body.code).toBe(ErrorCodes.SUCCESS);
    expect(body.data.householdId).toBeDefined();
    expect(isUUID(body.data.householdId!)).toBe(true);

    const householdRows = await sql<
      Array<{ id: string; head_id: string | null; number: string; status: string }>
    >`
      SELECT id, head_id, number, status
      FROM households
      WHERE id = ${body.data.householdId!}
    `;
    expect(householdRows).toHaveLength(1);
    const createdHousehold = householdRows[0];
    expect(createdHousehold.number).toBe("501");
    expect(createdHousehold.status).toBe("ACTIVE");

    const residentRows = await sql<
      Array<{
        id: string;
        household_id: string;
        name: string;
        phone_number: string | null;
        birth_date: string;
        relationship: string;
      }>
    >`
      SELECT
        id,
        household_id,
        name,
        phone_number,
        TO_CHAR(birth_date, 'YYYY-MM-DD') AS birth_date,
        relationship
      FROM residents
      WHERE household_id = ${body.data.householdId!}
    `;
    expect(residentRows).toHaveLength(1);
    const createdResident = residentRows[0];

    expect(createdHousehold.head_id).toBe(createdResident.id);
    expect(createdResident.relationship).toBe("Chủ hộ");
    expect(createdResident.name).toBe("Lê Văn Cường");
    expect(createdResident.phone_number).toBe("0909123456");
    expect(createdResident.birth_date).toBe("1992-08-15");
  });

  it("returns 409 and does not insert duplicate household or resident when apartment number already exists", async () => {
    const beforeHouseholds = await sql<Array<{ count: string }>>`
      SELECT COUNT(*) AS count FROM households WHERE number = '101'
    `;
    const beforeResidents = await sql<Array<{ count: string }>>`
      SELECT COUNT(*) AS count FROM residents WHERE household_id = ${existingHouseholdId}
    `;

    const request = buildPostRequest({
      number: "101",
      headName: "Người Trùng Căn Hộ",
      headPhone: "0988777666",
      headBirthDate: "1991-03-20",
    });

    const response = await POST({ request } as APIEvent);
    expect(response.status).toBe(409);

    const body = (await response.json()) as { code: number };
    expect(body.code).toBe(ErrorCodes.DUPLICATE_OR_CONFLICT);

    const afterHouseholds = await sql<Array<{ count: string }>>`
      SELECT COUNT(*) AS count FROM households WHERE number = '101'
    `;
    const afterResidents = await sql<Array<{ count: string }>>`
      SELECT COUNT(*) AS count FROM residents WHERE household_id = ${existingHouseholdId}
    `;
    expect(Number(afterHouseholds[0].count)).toBe(Number(beforeHouseholds[0].count));
    expect(Number(afterResidents[0].count)).toBe(Number(beforeResidents[0].count));
  });

  it("returns 401 and does not insert data when request is unauthenticated", async () => {
    const request = buildPostRequest(
      {
        number: "502",
        headName: "Phạm Minh Đức",
        headPhone: "0911222333",
        headBirthDate: "1989-12-01",
      },
      { authenticated: false },
    );

    const response = await POST({ request } as APIEvent);
    expect(response.status).toBe(401);

    const body = (await response.json()) as { code: number };
    expect(body.code).toBe(ErrorCodes.UNAUTHENTICATED);

    const rows = await sql<Array<{ id: string }>>`
      SELECT id FROM households WHERE number = '502'
    `;
    expect(rows).toHaveLength(0);
  });

  it.each([
    {
      label: "missing apartment number",
      payload: {
        number: "   ",
        headName: "Nguyễn Văn A",
        headPhone: "0912345678",
        headBirthDate: "1990-01-01",
      },
    },
    {
      label: "missing head name",
      payload: {
        number: "503",
        headName: "",
        headPhone: "0912345678",
        headBirthDate: "1990-01-01",
      },
    },
    {
      label: "missing birth date",
      payload: {
        number: "504",
        headName: "Nguyễn Văn B",
        headPhone: "0912345678",
        headBirthDate: "",
      },
    },
  ])("returns 400 when $label", async ({ payload }) => {
    const request = buildPostRequest(payload);
    const response = await POST({ request } as APIEvent);
    expect(response.status).toBe(400);

    const body = (await response.json()) as { code: number };
    expect(body.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it("returns 400 when phone number format is invalid", async () => {
    const request = buildPostRequest({
      number: "505",
      headName: "Trần Thị Hoa",
      headPhone: "abc-invalid-phone",
      headBirthDate: "1995-07-07",
    });

    const response = await POST({ request } as APIEvent);
    expect(response.status).toBe(400);

    const body = (await response.json()) as { code: number };
    expect(body.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it("returns 403 when request origin does not match host", async () => {
    const request = buildPostRequest(
      {
        number: "506",
        headName: "Hoàng Văn Nam",
        headPhone: "0912345678",
        headBirthDate: "1990-02-02",
      },
      {
        host: "localhost:3000",
        origin: "https://evil.example.com",
      },
    );

    const response = await POST({ request } as APIEvent);
    expect(response.status).toBe(403);

    const body = (await response.json()) as { code: number };
    expect(body.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it.each([
    { label: "invalid calendar date", headBirthDate: "2020-02-30" },
    { label: "malformed date string", headBirthDate: "not-a-date" },
    { label: "future date", headBirthDate: "2099-01-01" },
  ])("returns 400 when birth date is $label", async ({ headBirthDate }) => {
    const request = buildPostRequest({
      number: "507",
      headName: "Vũ Thị Mai",
      headPhone: "0912345678",
      headBirthDate,
    });

    const response = await POST({ request } as APIEvent);
    expect(response.status).toBe(400);

    const body = (await response.json()) as { code: number };
    expect(body.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});
