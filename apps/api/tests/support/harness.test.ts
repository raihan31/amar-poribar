import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app-test.js";
import { withTestDb } from "./db-test.js";

describe("db test harness", () => {
  it("withTestDb isolates data between files", async () => {
    await withTestDb(async ({ sql }) => {
      await sql`create table public.iso_probe (id int)`;
      await sql`insert into public.iso_probe values (1)`;
    });
    await withTestDb(async ({ sql }) => {
      const r = await sql`select to_regclass('public.iso_probe') as t`;
      expect(r[0]!.t).toBeNull();
    });
  });

  it("truncateAll keeps migration table", async () => {
    await withTestDb(async ({ sql, truncateAll }) => {
      const before = await sql`select count(*)::int as n from platform.schema_migrations`;
      expect(before[0]!.n).toBeGreaterThan(0);
      await sql`create table ledger.trunc_probe (id int)`;
      await sql`insert into ledger.trunc_probe values (1)`;
      await truncateAll();
      const probe = await sql`select count(*)::int as n from ledger.trunc_probe`;
      expect(probe[0]!.n).toBe(0);
      const after = await sql`select count(*)::int as n from platform.schema_migrations`;
      expect(after[0]!.n).toBe(before[0]!.n);
    });
  });

  // Needs the identity tables from T-PLAT-23.
  it.skip("buildTestApp login helper returns working tokens", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const tokens = await t.login("01712345678");
      const me = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(tokens) });
      expect(me.statusCode).toBe(200);
      await t.close();
    });
  });
});
