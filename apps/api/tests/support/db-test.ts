import { randomUUID } from "node:crypto";
import { createDb, type Db, type Sql } from "../../src/platform/db.js";
import { DEFAULT_TEST_DATABASE_URL, TEMPLATE_DB, withDatabase } from "./global-setup.js";

export interface TestDb {
  db: Db;
  sql: Sql;
  url: string;
  /** Empty every table in the module schemas, keeping `platform.schema_migrations`. */
  truncateAll: () => Promise<void>;
}

export function adminUrl(): string {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

export async function truncateAll(sql: Sql): Promise<void> {
  const rows = await sql<{ s: string; t: string }[]>`
    select schemaname as s, tablename as t from pg_tables
    where schemaname not in ('pg_catalog', 'information_schema', 'public', 'drizzle')
      and not (schemaname = 'platform' and tablename = 'schema_migrations')`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.s}"."${r.t}"`).join(", ");
  await sql.unsafe(`truncate table ${list} restart identity cascade`);
}

export interface OwnedTestDb extends TestDb {
  /** Close the pool and drop the database. */
  drop: () => Promise<void>;
}

/** A fresh database cloned from the migrated template. The caller must `drop()` it (use in `beforeAll`/`afterAll`). */
export async function createTestDb(): Promise<OwnedTestDb> {
  const name = `test_${randomUUID().replaceAll("-", "")}`;
  const admin = createDb({ databaseUrl: adminUrl(), dbPoolMax: 1 });
  await admin.sql.unsafe(`create database ${name} template ${TEMPLATE_DB}`);
  const url = withDatabase(adminUrl(), name);
  const conn = createDb({ databaseUrl: url, dbPoolMax: 6 });
  return {
    db: conn.db,
    sql: conn.sql,
    url,
    truncateAll: () => truncateAll(conn.sql),
    drop: async () => {
      await conn.close();
      await admin.sql.unsafe(`drop database if exists ${name} with (force)`);
      await admin.close();
    },
  };
}

/** Run `fn` against a fresh database cloned from the migrated template; dropped afterwards. */
export async function withTestDb<T>(fn: (t: TestDb) => Promise<T>): Promise<T> {
  const t = await createTestDb();
  try {
    return await fn(t);
  } finally {
    await t.drop();
  }
}
