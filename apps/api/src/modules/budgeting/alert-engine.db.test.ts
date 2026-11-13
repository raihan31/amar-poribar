import { describe, expect, it } from "vitest";
import { buildTestApp, FIXED_NOW, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb, type TestDb } from "../../../tests/support/db-test.js";
import type { BudgetThresholdCrossedV1 } from "./events.js";

const JAN = "2026-01";
const IN_JAN = "2026-01-10T06:00:00.000Z";

interface Ctx {
  t: TestApp;
  owner: Tokens;
  familyId: string;
  food: string;
  travel: string;
  sql: TestDb["sql"];
}

async function setup(
  db: TestDb,
  clock?: () => Date,
  budgets?: (c: { food: string; travel: string }) => unknown[],
): Promise<Ctx> {
  const t = await buildTestApp({ db: db.db, sql: db.sql, ...(clock ? { clock } : {}) });
  const owner = await t.login("01711111111");
  const fam = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  const familyId = fam.json<{ id: string }>().id;
  const cats = await t.app.inject({
    method: "GET",
    url: `/v1/families/${familyId}/categories`,
    headers: t.as(owner),
  });
  const expense = cats.json<{ id: string; kind: string }[]>().filter((c) => c.kind === "expense");
  const food = expense[0]!.id;
  const travel = expense[1]!.id;
  const put = await t.app.inject({
    method: "PUT",
    url: `/v1/families/${familyId}/budgets?month=${JAN}`,
    headers: t.as(owner),
    payload: { budgets: budgets ? budgets({ food, travel }) : [{ categoryId: food, limitPaisa: 1_000_000 }] },
  });
  expect(put.statusCode).toBe(200);
  return { t, owner, familyId, food, travel, sql: db.sql };
}

async function spend(c: Ctx, amountPaisa: number, categoryId: string | null, extra: object = {}) {
  const res = await c.t.app.inject({
    method: "POST",
    url: `/v1/families/${c.familyId}/transactions`,
    headers: c.t.as(c.owner),
    payload: { type: "expense", amountPaisa, occurredAt: IN_JAN, categoryId, ...extra },
  });
  expect(res.statusCode).toBe(201);
  await c.t.drain();
  return res.json<{ id: string }>();
}

async function alerts(c: Ctx): Promise<BudgetThresholdCrossedV1[]> {
  const rows = await c.sql<{ payload: BudgetThresholdCrossedV1 }[]>`
    select payload from platform.outbox where name = 'budgeting.BudgetThresholdCrossed.v1' order by id`;
  return rows.map((r) => r.payload);
}

describe("alert engine (db)", () => {
  it("no alert below 80 percent", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db);
      await spend(c, 790_000, c.food);
      expect(await alerts(c)).toEqual([]);
      await c.t.close();
    });
  });

  it("crossing 80 fires one warning", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db);
      await spend(c, 800_000, c.food);
      const got = await alerts(c);
      expect(got).toHaveLength(1);
      expect(got[0]).toMatchObject({
        familyId: c.familyId,
        budgetKey: c.food,
        categoryId: c.food,
        month: JAN,
        threshold: 80,
        level: "warning",
        spentPaisa: 800_000,
        limitPaisa: 1_000_000,
      });
      expect(got[0]!.categoryNameBn).not.toBe("");
      await c.t.close();
    });
  });

  it("crossing 100 fires one exceeded", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db);
      await spend(c, 800_000, c.food);
      await spend(c, 200_000, c.food);
      const got = await alerts(c);
      expect(got.map((a) => [a.threshold, a.level])).toEqual([
        [80, "warning"],
        [100, "exceeded"],
      ]);
      await c.t.close();
    });
  });

  it("two more expenses after 100 fire nothing", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db);
      await spend(c, 1_000_000, c.food);
      expect(await alerts(c)).toHaveLength(2);
      await spend(c, 50_000, c.food);
      await spend(c, 70_000, c.food);
      expect(await alerts(c)).toHaveLength(2);
      await c.t.close();
    });
  });

  it("a jump past both thresholds fires 80 then 100", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db);
      await spend(c, 500_000, c.food);
      await spend(c, 700_000, c.food);
      const got = await alerts(c);
      expect(got.map((a) => a.threshold)).toEqual([80, 100]);
      await c.t.close();
    });
  });

  it("private expense of a member does not count toward alerts", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db);
      await spend(c, 900_000, c.food, { isPrivate: true });
      expect(await alerts(c)).toEqual([]);
      await spend(c, 700_000, c.food);
      expect(await alerts(c)).toEqual([]);
      await c.t.close();
    });
  });

  it("category budget and overall budget alert independently", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db, undefined, ({ food }) => [
        { categoryId: food, limitPaisa: 100_000 },
        { categoryId: null, limitPaisa: 1_000_000 },
      ]);
      await spend(c, 90_000, c.food);
      expect((await alerts(c)).map((a) => [a.budgetKey, a.threshold])).toEqual([[c.food, 80]]);
      await spend(c, 800_000, c.travel);
      const got = await alerts(c);
      expect(got.map((a) => [a.budgetKey, a.threshold])).toEqual([
        [c.food, 80],
        ["overall", 80],
      ]);
      expect(got[1]).toMatchObject({ categoryId: null, categoryNameBn: "মোট", categoryNameEn: "Overall" });
      await c.t.close();
    });
  });

  it("editing an expense to another category evaluates both categories", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db, undefined, ({ food, travel }) => [
        { categoryId: food, limitPaisa: 1_000_000 },
        { categoryId: travel, limitPaisa: 1_000_000 },
      ]);
      const trx = await spend(c, 500_000, c.food);
      await spend(c, 300_000, c.travel);
      expect(await alerts(c)).toEqual([]);
      // Move 500k from food to travel: travel reaches 80%. Food drops, which never removes anything.
      const patch = await c.t.app.inject({
        method: "PATCH",
        url: `/v1/families/${c.familyId}/transactions/${trx.id}`,
        headers: c.t.as(c.owner),
        payload: { categoryId: c.travel },
      });
      expect(patch.statusCode).toBe(200);
      await c.t.drain();
      expect((await alerts(c)).map((a) => [a.budgetKey, a.threshold])).toEqual([[c.travel, 80]]);
      await c.t.close();
    });
  });

  it("next month starts fresh", async () => {
    await withTestDb(async (db) => {
      let now = FIXED_NOW;
      const c = await setup(db, () => now);
      await spend(c, 800_000, c.food);
      expect(await alerts(c)).toHaveLength(1);
      // Budgets are inherited from January; the same spending in February fires again. The clock moves only
      // once the entry is written, so the access token stays valid.
      const res = await c.t.app.inject({
        method: "POST",
        url: `/v1/families/${c.familyId}/transactions`,
        headers: c.t.as(c.owner),
        payload: { type: "expense", amountPaisa: 800_000, occurredAt: "2026-02-10T06:00:00.000Z", categoryId: c.food },
      });
      expect(res.statusCode).toBe(201);
      now = new Date("2026-02-15T06:00:00.000Z");
      await c.t.drain();
      const got = await alerts(c);
      expect(got.map((a) => [a.month, a.threshold])).toEqual([
        ["2026-01", 80],
        ["2026-02", 80],
      ]);
      await c.t.close();
    });
  });

  it("replaying the same event publishes nothing twice", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db);
      await spend(c, 1_000_000, c.food);
      expect(await alerts(c)).toHaveLength(2);
      await c.sql`update platform.outbox set status = 'pending', next_attempt_at = now()`;
      await c.sql`delete from platform.outbox_deliveries`;
      await c.t.drain();
      expect((await alerts(c)).length).toBe(2);
      const rows = await c.sql`select 1 from budgeting.budget_alerts`;
      expect(rows).toHaveLength(2);
      await c.t.close();
    });
  });

  it("budget with limit zero never alerts", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db, undefined, ({ food }) => [{ categoryId: food, limitPaisa: 0 }]);
      await spend(c, 500_000, c.food);
      expect(await alerts(c)).toEqual([]);
      await c.t.close();
    });
  });

  it("AC-05: 10,000 taka bazaar budget, 7,900 then 200 then 2,000 taka", async () => {
    await withTestDb(async (db) => {
      const c = await setup(db);
      await spend(c, 790_000, c.food);
      expect(await alerts(c)).toHaveLength(0);
      await spend(c, 20_000, c.food);
      expect((await alerts(c)).map((a) => a.level)).toEqual(["warning"]);
      await spend(c, 200_000, c.food);
      expect((await alerts(c)).map((a) => a.level)).toEqual(["warning", "exceeded"]);
      await c.t.close();
    });
  });
});
