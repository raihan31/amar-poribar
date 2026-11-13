import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb, type TestDb } from "../../../tests/support/db-test.js";
import { EventBus } from "../../platform/events/bus.js";
import { createJobs } from "../../platform/jobs/jobs.js";
import { carryForwardJob } from "./jobs.js";
import type { BudgetsCarriedForwardV1 } from "./events.js";

const JAN = "2026-01";
const FEB = "2026-02";
/** 00:05 on 1 February in Asia/Dhaka is 18:05 on 31 January UTC. */
const FEB_FIRST_0005_DHAKA = new Date("2026-01-31T18:05:00.000Z");

async function newFamily(t: TestApp, owner: Tokens): Promise<string> {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function categories(t: TestApp, owner: Tokens, familyId: string): Promise<string[]> {
  const res = await t.app.inject({
    method: "GET",
    url: `/v1/families/${familyId}/categories`,
    headers: t.as(owner),
  });
  return res
    .json<{ id: string; kind: string }[]>()
    .filter((c) => c.kind === "expense")
    .map((c) => c.id);
}

async function put(t: TestApp, owner: Tokens, familyId: string, month: string, budgets: unknown[]) {
  const res = await t.app.inject({
    method: "PUT",
    url: `/v1/families/${familyId}/budgets?month=${month}`,
    headers: t.as(owner),
    payload: { budgets },
  });
  expect(res.statusCode).toBe(200);
}

function makeJob(t: TestApp, db: TestDb) {
  const jobs = createJobs({ inline: true });
  const def = carryForwardJob({
    db: db.db,
    bus: new EventBus(),
    clock: () => FEB_FIRST_0005_DHAKA,
    jobs,
    logger: t.app.log,
  });
  jobs.register(def);
  return { jobs, def, run: () => jobs.send(def.name, {}) };
}

interface Row {
  category_id: string | null;
  month: string;
  limit_paisa: string;
  source: string;
}
const rows = (db: TestDb, familyId: string, month: string) =>
  db.sql<Row[]>`select category_id, month, limit_paisa, source from budgeting.budgets
    where family_id = ${familyId} and month = ${month} order by limit_paisa`;

describe("budgeting.carry-forward (db)", () => {
  it("copies last month's budgets on the first", async () => {
    await withTestDb(async (db) => {
      const t = await buildTestApp({ db: db.db, sql: db.sql });
      const owner = await t.login("01711111111");
      const familyId = await newFamily(t, owner);
      const [food] = await categories(t, owner, familyId);
      await put(t, owner, familyId, JAN, [
        { categoryId: null, limitPaisa: 5_000_000 },
        { categoryId: food, limitPaisa: 1_000_000 },
      ]);
      await makeJob(t, db).run();
      const got = await rows(db, familyId, FEB);
      expect(got.map((r) => [r.category_id, Number(r.limit_paisa), r.source])).toEqual([
        [food, 1_000_000, "carried"],
        [null, 5_000_000, "carried"],
      ]);
      const res = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/budgets?month=${FEB}`,
        headers: t.as(owner),
      });
      const body = res.json<{ budgets: { inherited: boolean; carried: boolean }[] }>();
      expect(body.budgets).toHaveLength(2);
      for (const b of body.budgets) expect(b).toMatchObject({ inherited: false, carried: true });
      await t.close();
    });
  });

  it("does not overwrite a budget set manually", async () => {
    await withTestDb(async (db) => {
      const t = await buildTestApp({ db: db.db, sql: db.sql });
      const owner = await t.login("01711111111");
      const familyId = await newFamily(t, owner);
      await put(t, owner, familyId, JAN, [{ categoryId: null, limitPaisa: 5_000_000 }]);
      await put(t, owner, familyId, FEB, [{ categoryId: null, limitPaisa: 7_000_000 }]);
      await makeJob(t, db).run();
      const got = await rows(db, familyId, FEB);
      expect(got.map((r) => [Number(r.limit_paisa), r.source])).toEqual([[7_000_000, "manual"]]);
      await t.close();
    });
  });

  it("skips cleared budgets", async () => {
    await withTestDb(async (db) => {
      const t = await buildTestApp({ db: db.db, sql: db.sql });
      const owner = await t.login("01711111111");
      const familyId = await newFamily(t, owner);
      const [food, travel] = await categories(t, owner, familyId);
      await put(t, owner, familyId, JAN, [
        { categoryId: food, limitPaisa: 1_000_000 },
        { categoryId: travel, limitPaisa: 0 },
      ]);
      await makeJob(t, db).run();
      const got = await rows(db, familyId, FEB);
      expect(got.map((r) => r.category_id)).toEqual([food]);
      await t.close();
    });
  });

  it("running twice creates no duplicates", async () => {
    await withTestDb(async (db) => {
      const t = await buildTestApp({ db: db.db, sql: db.sql });
      const owner = await t.login("01711111111");
      const familyId = await newFamily(t, owner);
      await put(t, owner, familyId, JAN, [{ categoryId: null, limitPaisa: 5_000_000 }]);
      const job = makeJob(t, db);
      await job.run();
      await job.run();
      expect(await rows(db, familyId, FEB)).toHaveLength(1);
      const events = await db.sql`select 1 from platform.outbox where name = 'budgeting.BudgetsCarriedForward.v1'`;
      expect(events).toHaveLength(1);
      await t.close();
    });
  });

  it("families with no previous budgets get nothing", async () => {
    await withTestDb(async (db) => {
      const t = await buildTestApp({ db: db.db, sql: db.sql });
      const owner = await t.login("01711111111");
      const familyId = await newFamily(t, owner);
      await makeJob(t, db).run();
      expect(await rows(db, familyId, FEB)).toHaveLength(0);
      const events = await db.sql`select 1 from platform.outbox where name = 'budgeting.BudgetsCarriedForward.v1'`;
      expect(events).toHaveLength(0);
      await t.close();
    });
  });

  it("job is scheduled with Asia/Dhaka timezone", async () => {
    await withTestDb(async (db) => {
      const t = await buildTestApp({ db: db.db, sql: db.sql });
      const owner = await t.login("01711111111");
      const familyId = await newFamily(t, owner);
      await put(t, owner, familyId, JAN, [{ categoryId: null, limitPaisa: 5_000_000 }]);
      let now = new Date("2026-01-31T18:00:00.000Z");
      const jobs = createJobs({ inline: true, clock: () => now });
      const def = carryForwardJob({
        db: db.db,
        bus: new EventBus(),
        clock: () => FEB_FIRST_0005_DHAKA,
        jobs,
        logger: t.app.log,
      });
      jobs.register(def);
      expect(def.name).toBe("budgeting.carry-forward");
      expect(def.cron).toBe("5 0 1 * *");
      expect(await jobs.runDue()).toEqual([]);
      now = FEB_FIRST_0005_DHAKA;
      expect(await jobs.runDue()).toEqual(["budgeting.carry-forward"]);
      expect(await rows(db, familyId, FEB)).toHaveLength(1);
      await t.close();
    });
  });

  it("event published once per family", async () => {
    await withTestDb(async (db) => {
      const t = await buildTestApp({ db: db.db, sql: db.sql });
      const a = await t.login("01711111111");
      const b = await t.login("01722222222");
      const famA = await newFamily(t, a);
      const famB = await newFamily(t, b);
      const [food] = await categories(t, a, famA);
      await put(t, a, famA, JAN, [
        { categoryId: null, limitPaisa: 5_000_000 },
        { categoryId: food, limitPaisa: 1_000_000 },
      ]);
      await put(t, b, famB, JAN, [{ categoryId: null, limitPaisa: 3_000_000 }]);
      await makeJob(t, db).run();
      const events = await db.sql<{ payload: BudgetsCarriedForwardV1 }[]>`
        select payload from platform.outbox where name = 'budgeting.BudgetsCarriedForward.v1'`;
      const byFamily = new Map(events.map((e) => [e.payload.familyId, e.payload]));
      expect(events).toHaveLength(2);
      expect(byFamily.get(famA)).toEqual({ familyId: famA, month: FEB, count: 2 });
      expect(byFamily.get(famB)).toEqual({ familyId: famB, month: FEB, count: 1 });
      await t.close();
    });
  });
});
