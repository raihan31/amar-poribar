import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { createDb } from "../../src/platform/db.js";
import { runMigrations } from "../../src/platform/migrate.js";

export const DEFAULT_TEST_DATABASE_URL = "postgres://amar:amar@localhost:5433/amar_test";
export const TEMPLATE_DB = "amar_template";
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

async function reachable(url: string): Promise<boolean> {
  const sql = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** URL of the same server with another database name. */
export function withDatabase(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

/**
 * Resolve the server (TEST_DATABASE_URL, else DATABASE_URL, else the compose `db-test` service),
 * build a migrated template database once, and export TEST_DATABASE_URL for the test workers.
 */
export default async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  if (!(await reachable(url))) {
    execFileSync("docker", ["compose", "--profile", "test", "up", "-d", "db-test", "minio-test", "--wait"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    if (!(await reachable(url))) throw new Error(`Test database not reachable at ${url}`);
  }
  process.env.TEST_DATABASE_URL = url;

  const admin = createDb({ databaseUrl: url, dbPoolMax: 2 });
  try {
    await admin.sql.unsafe(`drop database if exists ${TEMPLATE_DB} with (force)`);
    await admin.sql.unsafe(`create database ${TEMPLATE_DB}`);
  } finally {
    await admin.close();
  }
  const tpl = createDb({ databaseUrl: withDatabase(url, TEMPLATE_DB), dbPoolMax: 4 });
  try {
    await runMigrations(tpl.sql);
  } finally {
    await tpl.close();
  }
}
