import { describe, expect, it } from "vitest";
import { buildTestApp } from "../../../../tests/support/app-test.js";
import { withTestDb } from "../../../../tests/support/db-test.js";
import { getPlanCatalogue } from "./catalogue.js";

describe("plan catalogue (db)", () => {
  it("seed has three plans", async () => {
    await withTestDb(async ({ db, sql }) => {
      const plans = await getPlanCatalogue(db);
      expect(plans.map((p) => p.id)).toEqual(["free", "plus", "probashi"]);
      expect(plans.map((p) => [p.priceMonthPaisa, p.priceYearPaisa])).toEqual([
        [0, null],
        [9900, 99900],
        [14900, null],
      ]);
      const rows = await sql`select count(*)::int as n from billing.plan_limits`;
      expect(rows[0]?.n).toBe(24);
    });
  });

  it("limits typed", async () => {
    await withTestDb(async ({ db }) => {
      const [free, plus, probashi] = await getPlanCatalogue(db);
      expect(free?.limits).toEqual({
        membersMax: 3,
        aiEntriesMonth: 100,
        historyMonths: 6,
        receiptVision: false,
        ask: false,
        exportBeyondCsv: false,
        multiCurrency: false,
        remittancePlanner: false,
      });
      expect(plus?.limits).toEqual({
        membersMax: 8,
        aiEntriesMonth: 1000,
        historyMonths: null,
        receiptVision: true,
        ask: true,
        exportBeyondCsv: true,
        multiCurrency: false,
        remittancePlanner: false,
      });
      expect(probashi?.limits).toEqual({ ...plus?.limits, multiCurrency: true, remittancePlanner: true });
    });
  });

  it("GET /v1/plans", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const anon = await t.app.inject({ method: "GET", url: "/v1/plans" });
      expect(anon.statusCode).toBe(401);
      const u = await t.login("01712345678");
      const res = await t.app.inject({ method: "GET", url: "/v1/plans", headers: t.as(u) });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items).toHaveLength(3);
      expect(body.items[1]).toMatchObject({
        id: "plus",
        nameEn: "Poribar Plus",
        priceMonthPaisa: 9900,
        priceYearPaisa: 99900,
        limits: { membersMax: 8, historyMonths: null, ask: true },
      });
      await t.close();
    });
  });
});
