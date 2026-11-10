import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Sql } from "./db.js";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));
const LOCK_ID = 727001;

/**
 * Apply pending SQL migrations from `apps/api/drizzle`, serialised by an advisory lock.
 * The lock is held by one open transaction while the migrator uses a second pooled connection,
 * so the pool needs at least two connections.
 */
export async function runMigrations(sql: Sql, migrationsFolder: string = MIGRATIONS_FOLDER): Promise<void> {
  await sql.begin(async (lockTx) => {
    await lockTx`select pg_advisory_xact_lock(${LOCK_ID})`;
    await sql`create schema if not exists platform`;
    await migrate(drizzle(sql), {
      migrationsFolder,
      migrationsSchema: "platform",
      migrationsTable: "schema_migrations",
    });
  });
}
