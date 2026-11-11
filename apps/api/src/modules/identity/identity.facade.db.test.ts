import Fastify from "fastify";
import { describe, expect, expectTypeOf, it } from "vitest";
import { withTestDb } from "../../../tests/support/db-test.js";
import { testConfig } from "../../../tests/support/config.js";
import { createJobs } from "../../platform/jobs/jobs.js";
import type { ModuleContext } from "../../platform/module.js";
import { MemoryLimiter } from "../../platform/rate-limit/limiter.js";
import { identityModule, maskPhone, type UserSummary } from "./index.js";

async function facade(db: ModuleContext["db"]) {
  const app = Fastify();
  const ctx = {
    db,
    config: testConfig(),
    limiter: new MemoryLimiter(),
    jobs: createJobs({ inline: true }),
    clock: () => new Date(),
  } as unknown as ModuleContext;
  return identityModule.register(app, ctx);
}

describe("identity facade (db)", () => {
  it("getUser returns null for unknown id", async () => {
    await withTestDb(async ({ db }) => {
      const f = await facade(db);
      expect(await f.getUser("00000000-0000-4000-8000-000000000000")).toBeNull();
    });
  });

  it("requireUser rejects erased users", async () => {
    await withTestDb(async ({ db, sql }) => {
      const f = await facade(db);
      const { id } = await f.createUserIfMissing("+8801712345678");
      expect((await f.requireUser(id)).id).toBe(id);
      await sql`update identity.users set erased_at = now() where id = ${id}`;
      await expect(f.requireUser(id)).rejects.toMatchObject({ status: 401, code: "unauthorized" });
      await expect(f.requireUser("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ status: 401 });
    });
  });

  it("getUsers returns map for many ids", async () => {
    await withTestDb(async ({ db }) => {
      const f = await facade(db);
      const a = await f.createUserIfMissing("+8801712345678");
      const b = await f.createUserIfMissing("+8801812345678");
      const m = await f.getUsers([a.id, b.id]);
      expect([...m.keys()].sort()).toEqual([a.id, b.id].sort());
      expect(m.get(a.id)).toMatchObject({ numeralStyle: "bn", simpleMode: false, locale: "bn" });
      expect(m.get(a.id)).not.toHaveProperty("phone");
      expect((await f.getUserWithPhone(a.id))?.phone).toBe("+8801712345678");
      expect((await f.findUserByPhone("+8801812345678"))?.id).toBe(b.id);
    });
  });

  it("maskPhone keeps last three digits", () => {
    expect(maskPhone("+8801712345678")).toBe("•••678");
  });

  it("facade never exposes phone in UserSummary", () => {
    expectTypeOf<UserSummary>().not.toHaveProperty("phone");
    expectTypeOf<keyof UserSummary>().toEqualTypeOf<"id" | "name" | "locale" | "numeralStyle" | "simpleMode">();
  });
});
