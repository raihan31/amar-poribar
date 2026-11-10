import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nowIso, openE2e, seedFamily, type E2e, type Seeded } from "../support/e2e.js";

let e: E2e;
let s: Seeded;
const { now } = nowIso();

beforeAll(async () => {
  e = await openE2e();
  s = await seedFamily(e, ["01710000006", "01810000006", "01910000006"]);
  const post = (body: unknown) => e.call("POST", `/v1/families/${s.F}/transactions`, { token: s.A, body });
  await post({
    type: "expense",
    amountPaisa: 90000,
    occurredAt: now,
    categoryId: s.cats.find((c) => c.key === "bazaar")!.id,
    accountId: s.accs[0]!.id,
    note: "bazaar",
  });
  await post({
    type: "income",
    amountPaisa: 2000000,
    occurredAt: now,
    categoryId: s.cats.find((c) => c.key === "remittance")!.id,
    counterparty: "Tanvir",
    note: "=cmd|calc",
  });
  await post({ type: "expense", amountPaisa: 5000, occurredAt: now, isPrivate: true, note: "secret" });
});
afterAll(() => e.dispose());

describe("reports (e2e)", () => {
  it("summary has previous, byMember and byAccount, and hides a private entry from other members", async () => {
    const sum = (await e.call("GET", `/v1/families/${s.F}/reports/summary`, { token: s.B })).json;
    expect(sum.previous).toBeTruthy();
    expect(sum.byMember.length).toBeGreaterThanOrEqual(1);
    expect(sum.byAccount.length).toBeGreaterThanOrEqual(1);
    expect(sum.expensePaisa).toBe(90000);
  });

  it("the creator sees their own private entry", async () => {
    const sumA = (await e.call("GET", `/v1/families/${s.F}/reports/summary`, { token: s.A })).json;
    expect(sumA.expensePaisa).toBe(95000);
  });

  it("remittance report is visible to a viewer", async () => {
    const rem = (await e.call("GET", `/v1/families/${s.F}/reports/remittances`, { token: s.C })).json;
    expect(rem.totalRemittancePaisa).toBe(2000000);
    expect(rem.bySender[0].name).toBe("Tanvir");
    expect(rem.months).toHaveLength(6);
  });

  it("csv starts with a UTF-8 BOM", async () => {
    const csv = await e.call("GET", `/v1/families/${s.F}/reports/export.csv`, { token: s.A });
    expect(csv.status).toBe(200);
    expect([...csv.raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("csv has the header, the formula guard and exact amounts", async () => {
    const csv = await e.call("GET", `/v1/families/${s.F}/reports/export.csv`, { token: s.A });
    expect(csv.text.replace(/^﻿/, "").startsWith("Date,Type")).toBe(true);
    expect(csv.text).toContain("'=cmd|calc");
    expect(csv.text).toContain("900.00");
  });
});
