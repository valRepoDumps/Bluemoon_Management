import postgres from 'postgres';
import { mockDatabase } from '~/server/database/placeholder-data';
import { ApiResponse } from '~/server/api/ApiResponse';
import { ErrorCodes } from '~/server/api/ErrorCode';

const sql = postgres(process.env.DATABASE_URL!);

// Transaction handle, so every seed step runs inside the same transaction
//open page api/seed to seed database. 
//rmb to run docker compose up -d to create docker instance. 
type Tx = postgres.TransactionSql;

async function seedUsers(sql: Tx) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      deleted_at TIMESTAMP
    );
  `;

  const insertedUsers = await Promise.all(
    mockDatabase.users.map(
      (user) => sql`
        INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at, deleted_at)
        VALUES (${user.id}, ${user.email}, ${user.passwordHash}, ${user.name}, ${user.role},
                ${user.createdAt}, ${user.updatedAt}, ${user.deletedAt})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );

  return insertedUsers;
}

async function seedSessions(sql: Tx) {
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL,
      expires_at TIMESTAMP NOT NULL
    );
  `;

  const insertedSessions = await Promise.all(
    mockDatabase.sessions.map(
      (session) => sql`
        INSERT INTO sessions (id, user_id, token, created_at, expires_at)
        VALUES (${session.id}, ${session.userId}, ${session.token},
                ${session.createdAt}, ${session.expiresAt})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );

  return insertedSessions;
}

async function seedHouseholds(sql: Tx) {
  await sql`
    CREATE TABLE IF NOT EXISTS households (
      id INTEGER PRIMARY KEY,
      head_id INTEGER,
      number VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL
    );
  `;

  const insertedHouseholds = await Promise.all(
    mockDatabase.households.map(
      (household) => sql`
        INSERT INTO households (id, head_id, number, status)
        VALUES (${household.id}, ${household.headId}, ${household.number}, ${household.status})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );

  return insertedHouseholds;
}

async function seedResidents(sql: Tx) {
  await sql`
    CREATE TABLE IF NOT EXISTS residents (
      id INTEGER PRIMARY KEY,
      household_id INTEGER NOT NULL REFERENCES households(id),
      phone_number VARCHAR(20) NOT NULL,
      birth_date DATE NOT NULL,
      relationship VARCHAR(50) NOT NULL
    );
  `;

  const insertedResidents = await Promise.all(
    mockDatabase.residents.map(
      (resident) => sql`
        INSERT INTO residents (id, household_id, phone_number, birth_date, relationship)
        VALUES (${resident.id}, ${resident.householdId}, ${resident.phoneNumber},
                ${resident.birthDate}, ${resident.relationship})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );

  return insertedResidents;
}

export async function GET() {
  try {
    await sql.begin(async (sql) => {
      // Prevents two simultaneous seed requests from colliding on CREATE TABLE
      await sql`SELECT pg_advisory_xact_lock(424242)`;

      // Order matters: sessions need users, residents need households
      await seedUsers(sql);
      await seedSessions(sql);
      await seedHouseholds(sql);
      await seedResidents(sql);
    });

    return Response.json(
      new ApiResponse(ErrorCodes.SUCCESS, { message: 'Successfully created database!' }),
      { status: 200 },
    );
  } catch (error: unknown) {

    return Response.json(
      new ApiResponse(ErrorCodes.SYSTEM_OR_DATABASE_ERROR, {
        message: 'Failed to create database',
        error: error instanceof Error ? (error.message || (error as any).code || error.name) : 'Unknown error',
      }),
      { status: 500 },
    );
  }
}