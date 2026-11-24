import type postgres from 'postgres';
import type { UserDB, SessionDB, HouseholdDB, ResidentDB } from './DatabaseProp';

// Works with both the main connection and a transaction handle
export type Tx = postgres.Sql | postgres.TransactionSql;

// Using tx, your seed is all-or-nothing: (TransactionSql)
// BEGIN
//   create users, insert users
//   create sessions, insert sessions   <- fails here
// ROLLBACK   -> database is untouched, no half-seeded tables

// With the main sql (postgres.Sql), the users table would already exist and be filled when sessions fails, leaving a half-seeded database.
//-> allow for bot to be used in Tx. 

export async function seedUsers(sql: Tx, users: UserDB[]) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      deleted_at TIMESTAMP
    );
  `;

  return Promise.all(
    users.map(
      (user) => sql`
        INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at, deleted_at)
        VALUES (${user.id}, ${user.email}, ${user.passwordHash}, ${user.name}, ${user.role},
                ${user.createdAt}, ${user.updatedAt}, ${user.deletedAt})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );
}

export async function seedSessions(sql: Tx, sessions: SessionDB[]) {
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      token VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL,
      expires_at TIMESTAMP NOT NULL
    );
  `;

  return Promise.all(
    sessions.map(
      (session) => sql`
        INSERT INTO sessions (id, user_id, token, created_at, expires_at)
        VALUES (${session.id}, ${session.userId}, ${session.token},
                ${session.createdAt}, ${session.expiresAt})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );
}

export async function seedHouseholds(sql: Tx, households: HouseholdDB[]) {
  await sql`
    CREATE TABLE IF NOT EXISTS households (
      id UUID PRIMARY KEY,
      head_id UUID,
      number VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL
    );
  `;

  return Promise.all(
    households.map(
      (household) => sql`
        INSERT INTO households (id, head_id, number, status)
        VALUES (${household.id}, ${household.headId}, ${household.number}, ${household.status})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );
}

export async function seedResidents(sql: Tx, residents: ResidentDB[]) {
  await sql`
    CREATE TABLE IF NOT EXISTS residents (
      id UUID PRIMARY KEY,
      household_id UUID NOT NULL REFERENCES households(id),
      name VARCHAR(255),
      phone_number VARCHAR(20),
      birth_date DATE NOT NULL,
      relationship VARCHAR(50) NOT NULL
    );
  `;

  // Migrate databases that were created before residents had a name column.
  await sql`ALTER TABLE residents ADD COLUMN IF NOT EXISTS name VARCHAR(255);`;

  return Promise.all(
    residents.map(
      (resident) => sql`
        INSERT INTO residents (id, household_id, name, phone_number, birth_date, relationship)
        VALUES (${resident.id}, ${resident.householdId}, ${resident.name}, ${resident.phoneNumber},
                ${resident.birthDate}, ${resident.relationship})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );
}