import type { Sql } from "./db.js";
import { MODULE_SCHEMA_NAMES } from "./schema-names.js";
import { runMigrations } from "./migrate.js";

/** Drop every module schema (and the legacy `public` drizzle table) and re-run migrations. Never in production. */
export async function resetDatabase(sql: Sql, nodeEnv: string | undefined): Promise<void> {
  if (nodeEnv === "production") throw new Error("db:reset refuses to run when NODE_ENV=production");
  for (const name of MODULE_SCHEMA_NAMES) await sql.unsafe(`drop schema if exists "${name}" cascade`);
  await sql.unsafe(`drop table if exists public.__drizzle_migrations cascade`);
  await runMigrations(sql);
}
