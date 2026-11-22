import postgres from "postgres";

let sqlInstance: postgres.Sql | null = null;

/**
 * Returns a shared PostgreSQL connection pool using DATABASE_URL.
 */
export function getDb(): postgres.Sql {
  if (!sqlInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }
    sqlInstance = postgres(url);
  }
  return sqlInstance;
}
