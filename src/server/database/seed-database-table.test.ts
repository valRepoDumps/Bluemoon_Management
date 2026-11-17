import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { generateUUID } from '~/types/UUID';
import { mockDatabase } from './placeholder-data';
import { isUUID } from '~/types/UUID';
import type { UserDB, SessionDB, HouseholdDB, ResidentDB } from './DatabaseProp';
import { seedUsers, seedSessions, seedHouseholds, seedResidents } from './seed-database-table';

import { UserID } from '~/types/Ids';

import { HouseholdStatus } from '~/types/Household';
import { UserRole } from '~/types/User';
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const schema = `test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let admin: postgres.Sql;
let sql: postgres.Sql;

// Fixtures with real UUIDs, independent of mockDatabase
const userId = generateUUID();
const householdId = generateUUID();
const now = '2026-11-17T00:00:00Z';

const users: UserDB[] = [
  { id: userId, email: 'a@test.com', passwordHash: 'x', name: 'A', role: UserRole.ADMIN,
    createdAt: now, updatedAt: now, deletedAt: null },
];
const sessions: SessionDB[] = [
  { id: generateUUID(), userId, token: 't', createdAt: now, expiresAt: now },
];
const households: HouseholdDB[] = [
  { id: householdId, headId: null, number: 1, status: HouseholdStatus.ACTIVE},
];
const residents: ResidentDB[] = [
  { id: generateUUID(), householdId, phoneNumber: null, birthDate: '1990-01-01', relationship: 'Chủ hộ' },
];

async function seedAll(db: postgres.Sql | postgres.TransactionSql) {
  await seedUsers(db, users);
  await seedSessions(db, sessions);
  await seedHouseholds(db, households);
  await seedResidents(db, residents);
}

const count = async (table: string) =>
  Number((await sql.unsafe(`SELECT count(*) FROM ${table}`))[0].count);

beforeAll(async () => {
  if (!url) throw new Error('Set TEST_DATABASE_URL or DATABASE_URL');
  admin = postgres(url, { max: 1 });
  await admin.unsafe(`CREATE SCHEMA ${schema}`);
  // every query on this connection resolves tables inside the temp schema
  sql = postgres(url, { max: 1, connection: { search_path: schema } });
});

afterAll(async () => {
  await sql?.end();
  await admin?.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin?.end();
});

describe('seed tables', () => {
  it('creates tables and inserts rows', async () => {
    await sql.begin((tx) => seedAll(tx));
    expect(await count('users')).toBe(1);
    expect(await count('sessions')).toBe(1);
    expect(await count('households')).toBe(1);
    expect(await count('residents')).toBe(1);
  });

  it('is idempotent (running twice adds no duplicates)', async () => {
    await sql.begin((tx) => seedAll(tx));
    await sql.begin((tx) => seedAll(tx));
    expect(await count('users')).toBe(1);
    expect(await count('residents')).toBe(1);
  });

  it('stores values correctly', async () => {
    const [row] = await sql`SELECT * FROM users WHERE id = ${userId}`;
    expect(row.email).toBe('a@test.com');
    expect(row.role).toBe('ADMIN');
    expect(row.deleted_at).toBeNull();
  });

  it('allows a null phone number', async () => {
    const [row] = await sql`SELECT phone_number FROM residents`;
    expect(row.phone_number).toBeNull();
  });

  it('enforces foreign keys', async () => {
    const orphan: SessionDB = { ...sessions[0], id: generateUUID(), userId: generateUUID() };
    await expect(seedSessions(sql, [orphan])).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects malformed UUIDs', async () => {
    const bad: UserDB = { ...users[0], id: 'not-a-uuid', email: 'b@test.com' };
    await expect(seedUsers(sql, [bad])).rejects.toMatchObject({ code: '22P02' });
  });

  it('rejects duplicate emails', async () => {
    const dup: UserDB = { ...users[0], id: generateUUID() }; // same email, new id
    await expect(seedUsers(sql, [dup])).rejects.toMatchObject({ code: '23505' });
  });
});

describe('transactions', () => {
  it('rolls back everything if a step fails', async () => {
    const tmp = `${schema}_rb`;
    await admin.unsafe(`CREATE SCHEMA ${tmp}`);
    const rb = postgres(url!, { max: 1, connection: { search_path: tmp } });
    try {
      await expect(
        rb.begin(async (tx) => {
          await seedUsers(tx, users);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      // table creation was rolled back too
      const [{ exists }] = await rb`SELECT to_regclass(${tmp + '.users'}) IS NOT NULL AS exists`;
      expect(exists).toBe(false);
    } finally {
      await rb.end();
      await admin.unsafe(`DROP SCHEMA ${tmp} CASCADE`);
    }
  });
});

describe('mockDatabase', () => {
  it('only contains valid UUID ids and consistent references', () => {
    const { users, sessions, households, residents } = mockDatabase;
    [...users, ...sessions, ...households, ...residents].forEach((o) =>
      expect(isUUID(o.id)).toBe(true));

    const userIds = new Set(users.map((u) => u.id));
    const householdIds = new Set(households.map((h) => h.id));
    const residentById = new Map(residents.map((r) => [r.id, r]));

    sessions.forEach((s) => expect(userIds.has(s.userId)).toBe(true));
    residents.forEach((r) => expect(householdIds.has(r.householdId)).toBe(true));
    // a household head must be a resident of that same household (or null)
    households.forEach((h) => {
      if (h.headId) expect(residentById.get(h.headId)?.householdId).toBe(h.id);
    });
  });
});