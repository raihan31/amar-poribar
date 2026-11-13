import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nowIso, openE2e, seedFamily, type E2e, type Seeded } from "../support/e2e.js";

let e: E2e;
let s: Seeded;
const { now, month, today } = nowIso();
let bazaarId: string;
type Budget = { categoryId: string | null; limitPaisa: number; spentPaisa: number; level: string; inherited: boolean };

const list = async (m: string) =>
  (await e.call("GET", `/v1/families/${s.F}/budgets?month=${m}`, { token: s.B })).json.budgets as Budget[];

beforeAll(async () => {
  e = await openE2e();
  s = await seedFamily(e, ["01710000004", "01810000004", "01910000004"]);
  bazaarId = s.cats.find((c) => c.key === "bazaar")!.id;
  await e.call("POST", `/v1/families/${s.F}/transactions`, {
    token: s.A,
    body: { type: "expense", amountPaisa: 90000, occurredAt: now, categoryId: bazaarId, accountId: s.accs[0]!.id },
  });
});
afterAll(() => e.dispose());

describe("budgets (e2e)", () => {
  it("put budgets", async () => {
    const put = await e.call("PUT", `/v1/families/${s.F}/budgets?month=${month}`, {
      token: s.A,
      body: {
        budgets: [
          { categoryId: bazaarId, limitPaisa: 100000 },
          { categoryId: null, limitPaisa: 5000000 },
        ],
      },
    });
    expect(put.status, put.text).toBe(200);
    expect(put.json.updated).toBe(2);
  });

  it("budget level warning at 90% and an overall budget", async () => {
    const bud = await list(month);
    const bz = bud.find((b) => b.categoryId === bazaarId)!;
    expect(bz.level).toBe("warning");
    expect(bz.spentPaisa).toBe(90000);
    expect(bud.some((b) => b.categoryId === null && b.limitPaisa === 5000000)).toBe(true);
  });

  it("overall budget is updated, not duplicated", async () => {
    await e.call("PUT", `/v1/families/${s.F}/budgets?month=${month}`, {
      token: s.A,
      body: { budgets: [{ categoryId: null, limitPaisa: 6000000 }] },
    });
    const bud = await list(month);
    const overall = bud.filter((b) => b.categoryId === null);
    expect(overall).toHaveLength(1);
    expect(overall[0]!.limitPaisa).toBe(6000000);
  });

  it("budgets carry forward", async () => {
    const [y, m] = month.split("-").map(Number) as [number, number];
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    const bud = await list(next);
    expect(bud).toHaveLength(2);
    expect(bud.every((b) => b.inherited)).toBe(true);
  });

  it("festival create, spend and level", async () => {
    const fb = await e.call("POST", `/v1/families/${s.F}/festival-budgets`, {
      token: s.A,
      body: { name: "Eid", startsOn: today, endsOn: today, limitPaisa: 100000 },
    });
    expect(fb.status, fb.text).toBe(201);
    const fl = (await e.call("GET", `/v1/families/${s.F}/festival-budgets`, { token: s.B })).json;
    expect(fl[0].spentPaisa).toBe(90000);
    expect(fl[0].level).toBe("warning");

    const bad = await e.call("PATCH", `/v1/families/${s.F}/festival-budgets/${fb.json.id}`, {
      token: s.A,
      body: { endsOn: "2000-01-01" },
    });
    expect(bad.status).toBe(400);
  });
});
