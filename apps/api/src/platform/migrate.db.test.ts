import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./db.js";
import { runMigrations } from "./migrate.js";
import { resetDatabase } from "./reset.js";
import { MODULE_SCHEMA_NAMES } from "./schema-names.js";

const url = process.env.TEST_DATABASE_URL;

describe("reset", () => {
  it("reset refuses in production", async () => {
    await expect(resetDatabase(undefined as never, "production")).rejects.toThrow(/production/);
  });
});

describe.skipIf(!url)("migrations", () => {
  const { sql, close } = createDb({ databaseUrl: url ?? "", dbPoolMax: 6 });
  const count = async () => Number((await sql`select count(*)::int as n from platform.schema_migrations`)[0]!.n);

  beforeAll(async () => {
    await resetDatabase(sql, "test");
  });
  afterAll(() => close());

  it("applies migrations once and records them", async () => {
    expect(await count()).toBeGreaterThanOrEqual(1);
    const rows = await sql`select schema_name from information_schema.schemata`;
    const names = rows.map((r) => r.schema_name as string);
    for (const n of MODULE_SCHEMA_NAMES) expect(names).toContain(n);
  });

  it("second run is a no-op", async () => {
    const before = await count();
    await runMigrations(sql);
    expect(await count()).toBe(before);
  });

  it("concurrent runs do not double apply", async () => {
    await sql.unsafe(`drop schema platform cascade`);
    await Promise.all([runMigrations(sql), runMigrations(sql), runMigrations(sql)]);
    const rows = await sql`select hash from platform.schema_migrations`;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(new Set(rows.map((r) => r.hash as string)).size).toBe(rows.length);
  });
});
