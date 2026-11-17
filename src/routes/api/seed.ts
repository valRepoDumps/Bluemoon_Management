import postgres from 'postgres';
import { mockDatabase } from '~/server/database/placeholder-data';
import { seedUsers, seedSessions, seedHouseholds, seedResidents } from '~/server/database/seed-database-table';
import { ApiResponse } from '~/server/api/ApiResponse';
import { ErrorCodes } from '~/server/api/ErrorCode';

const sql = postgres(process.env.DATABASE_URL!);

export async function GET() {
  try {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(424242)`;

      // Order matters: sessions need users, residents need households
      await seedUsers(tx, mockDatabase.users);
      await seedSessions(tx, mockDatabase.sessions);
      await seedHouseholds(tx, mockDatabase.households);
      await seedResidents(tx, mockDatabase.residents);
    });

    return Response.json(
      new ApiResponse(ErrorCodes.SUCCESS, { message: 'Successfully created database!' }),
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error('Database seeding failed:', error);
    return Response.json(
      new ApiResponse(ErrorCodes.SYSTEM_OR_DATABASE_ERROR, {
        message: 'Failed to create database',
        error: error instanceof Error ? (error.message || (error as any).code || error.name) : 'Unknown error',
      }),
      { status: 500 },
    );
  }
}