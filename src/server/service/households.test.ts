import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
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
import { getHouseholdsForRequest } from "~/server/service/households";
import { HouseholdStatus } from "~/types/Household";
import { UserRole } from "~/types/User";
import { generateUUID } from "~/types/UUID";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe.skipIf(!url)("households service (PostgreSQL integration)", () => {
  const schema = `test_households_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;

  const userId = generateUUID();
  const rawToken = generateSessionToken();

  const householdAId = generateUUID();
  const householdBId = generateUUID();
  const emptyHouseholdId = generateUUID();

  const headAId = generateUUID();
  const memberAId = generateUUID();
  const headBId = generateUUID();
  const nullNameResidentId = generateUUID();
  const emptyNameResidentId = generateUUID();

  const createAuthenticatedRequest = () =>
    new Request("http://localhost:3000/dashboard/households", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      },
    });

  beforeAll(async () => {
    admin = postgres(url!, { max: 1 });
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    sql = postgres(url!, { max: 1, connection: { search_path: schema } });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

    const users: UserDB[] = [
      {
        id: userId,
        email: "staff.test@bluemoon.com",
        passwordHash: "unused-in-session-test",
        name: "Nhân viên Kiểm thử",
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
        id: householdAId,
        headId: headAId,
        number: 101,
        status: HouseholdStatus.ACTIVE,
      },
      {
        id: householdBId,
        headId: headBId,
        number: 202,
        status: HouseholdStatus.ACTIVE,
      },
      {
        id: emptyHouseholdId,
        headId: null,
        number: 303,
        status: HouseholdStatus.VACANT,
      },
    ];

    const residents: ResidentDB[] = [
      {
        id: headAId,
        householdId: householdAId,
        name: "Nguyễn Văn An",
        phoneNumber: "0912345678",
        birthDate: "1985-04-12",
        relationship: "Chủ hộ",
      },
      {
        id: memberAId,
        householdId: householdAId,
        name: "Nguyễn Thị Bình",
        phoneNumber: null,
        birthDate: "1988-09-20",
        relationship: "Vợ",
      },
      {
        id: headBId,
        householdId: householdBId,
        name: "Trần Minh Châu",
        phoneNumber: "0987654321",
        birthDate: "1990-01-15",
        relationship: "Chủ hộ",
      },
      {
        id: nullNameResidentId,
        householdId: householdBId,
        name: null as unknown as string,
        phoneNumber: null,
        birthDate: "2015-06-01",
        relationship: "Con",
      },
      {
        id: emptyNameResidentId,
        householdId: householdBId,
        name: "   ",
        phoneNumber: "0901122334",
        birthDate: "2018-11-30",
        relationship: "Con",
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
    await sql?.end();
    await admin?.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin?.end();
  });

  it("rejects with Unauthenticated error when request has no valid session", async () => {
    const noCookieReq = new Request("http://localhost:3000/dashboard/households");
    await expect(getHouseholdsForRequest(sql, noCookieReq)).rejects.toThrow("Unauthenticated");

    const unknownTokenReq = new Request("http://localhost:3000/dashboard/households", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${"a".repeat(64)}`,
      },
    });
    await expect(getHouseholdsForRequest(sql, unknownTokenReq)).rejects.toThrow("Unauthenticated");
  });

  it("returns all households seeded in the test database", async () => {
    const households = await getHouseholdsForRequest(sql, createAuthenticatedRequest());

    expect(households).toHaveLength(3);
    expect(households.map((h) => h.id)).toEqual([
      householdAId,
      householdBId,
      emptyHouseholdId,
    ]);
    expect(households.map((h) => h.status)).toEqual([
      HouseholdStatus.ACTIVE,
      HouseholdStatus.ACTIVE,
      HouseholdStatus.VACANT,
    ]);
  });

  it("groups residents into their own household without mixing between households", async () => {
    const households = await getHouseholdsForRequest(sql, createAuthenticatedRequest());

    const householdA = households.find((h) => h.id === householdAId);
    const householdB = households.find((h) => h.id === householdBId);

    expect(householdA).toBeDefined();
    expect(householdB).toBeDefined();

    expect(householdA!.residents.map((r) => r.id)).toEqual([headAId, memberAId]);
    expect(householdB!.residents.map((r) => r.id)).toEqual([
      headBId,
      nullNameResidentId,
      emptyNameResidentId,
    ]);
  });

  it("identifies the household head accurately based on head_id", async () => {
    const households = await getHouseholdsForRequest(sql, createAuthenticatedRequest());

    const householdA = households.find((h) => h.id === householdAId);
    const householdB = households.find((h) => h.id === householdBId);

    expect(householdA?.head).not.toBeNull();
    expect(householdA?.head?.id).toBe(headAId);
    expect(householdA?.head?.name).toBe("Nguyễn Văn An");

    expect(householdB?.head).not.toBeNull();
    expect(householdB?.head?.id).toBe(headBId);
    expect(householdB?.head?.name).toBe("Trần Minh Châu");
  });

  it("returns empty residents array and null head for a household without residents", async () => {
    const households = await getHouseholdsForRequest(sql, createAuthenticatedRequest());

    const emptyHousehold = households.find((h) => h.id === emptyHouseholdId);
    expect(emptyHousehold).toBeDefined();
    expect(emptyHousehold!.residents).toEqual([]);
    expect(emptyHousehold!.head).toBeNull();
  });

  it("falls back to 'Chưa cập nhật tên' when resident name is null or empty/whitespace", async () => {
    const households = await getHouseholdsForRequest(sql, createAuthenticatedRequest());

    const householdB = households.find((h) => h.id === householdBId);
    const nullNameResident = householdB?.residents.find((r) => r.id === nullNameResidentId);
    const emptyNameResident = householdB?.residents.find((r) => r.id === emptyNameResidentId);

    expect(nullNameResident?.name).toBe("Chưa cập nhật tên");
    expect(emptyNameResident?.name).toBe("Chưa cập nhật tên");
  });

  it("formats phoneNumber, birthDate (YYYY-MM-DD), and converts number to string", async () => {
    const households = await getHouseholdsForRequest(sql, createAuthenticatedRequest());

    const householdA = households.find((h) => h.id === householdAId);
    const emptyHousehold = households.find((h) => h.id === emptyHouseholdId);

    expect(typeof householdA?.number).toBe("string");
    expect(householdA?.number).toBe("101");
    expect(typeof emptyHousehold?.number).toBe("string");
    expect(emptyHousehold?.number).toBe("303");

    const headA = householdA?.residents.find((r) => r.id === headAId);
    const memberA = householdA?.residents.find((r) => r.id === memberAId);

    expect(headA?.phoneNumber).toBe("0912345678");
    expect(headA?.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(headA?.birthDate).toBe("1985-04-12");

    expect(memberA?.phoneNumber).toBeNull();
    expect(memberA?.birthDate).toBe("1988-09-20");
  });
});
