import postgres from 'postgres';
import { mockDatabase } from '~/server/database/placeholder-data';
const sql = postgres(import.meta.env.DATABASE_URL)
//import.meta load variable from .env

async function seedDatabase() {
  try {
    console.log("🚀 Starting database seeding from mock data for BlueMoon Management System...");

    // 1. Seed Users Table dynamically from mockDatabase.users
    console.log("Seeding users...");
    for (const user of mockDatabase.users) {
      await sql`
        INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at, deleted_at)
        VALUES (${user.id}, ${user.email}, ${user.passwordHash}, ${user.name}, ${user.role}, ${user.createdAt}, ${user.updatedAt}, ${user.deletedAt})
        ON CONFLICT (id) DO UPDATE SET 
          email = EXCLUDED.email, 
          name = EXCLUDED.name, 
          role = EXCLUDED.role;
      `;
    }

    // 2. Seed Households Table dynamically from mockDatabase.households
    console.log("Seeding households...");
    for (const h of mockDatabase.households) {
      await sql`
        INSERT INTO households (id, head_id, number, status)
        VALUES (${h.id}, ${h.headId}, ${h.number}, ${h.status})
        ON CONFLICT (id) DO UPDATE SET 
          number = EXCLUDED.number, 
          status = EXCLUDED.status;
      `;
    }

    // 3. Seed Residents Table dynamically from mockDatabase.residents
    console.log("Seeding residents...");
    for (const r of mockDatabase.residents) {
      await sql`
        INSERT INTO residents (id, household_id, phone_number, birth_date, relationship)
        VALUES (${r.id}, ${r.householdId}, ${r.phoneNumber}, ${r.birthDate}, ${r.relationship})
        ON CONFLICT (id) DO UPDATE SET 
          phone_number = EXCLUDED.phone_number, 
          relationship = EXCLUDED.relationship;
      `;
    }

    // 4. Seed Sessions Table dynamically from mockDatabase.sessions
    console.log("Seeding sessions...");
    for (const s of mockDatabase.sessions) {
      await sql`
        INSERT INTO sessions (id, user_id, token, created_at, expires_at)
        VALUES (${s.id}, ${s.userId}, ${s.token}, ${s.createdAt}, ${s.expiresAt})
        ON CONFLICT (id) DO UPDATE SET 
          token = EXCLUDED.token, 
          expires_at = EXCLUDED.expires_at;
      `;
    }

    console.log("✅ Database seeding completed successfully using mock database file!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    // Always close connection pool when finished
    await sql.end();
  }
}

seedDatabase();