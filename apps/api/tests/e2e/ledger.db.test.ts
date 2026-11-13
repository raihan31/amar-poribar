import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nowIso, openE2e, seedFamily, type E2e, type Seeded } from "../support/e2e.js";

let e: E2e;
let s: Seeded;
const { now } = nowIso();
let txnId: string;
let firstHlc: string;

beforeAll(async () => {
  e = await openE2e();
  s = await seedFamily(e, ["01710000003", "01810000003", "01910000003"]);
});
afterAll(() => e.dispose());

describe("ledger (e2e)", () => {
  it("create txn with hlc", async () => {
    const bazaar = s.cats.find((c) => c.key === "bazaar")!;
    const t1 = await e.call("POST", `/v1/families/${s.F}/transactions`, {
      token: s.A,
      body: {
        type: "expense",
        amountPaisa: 85000,
        occurredAt: now,
        categoryId: bazaar.id,
        accountId: s.accs[0]!.id,
        note: "bazaar",
      },
    });
    expect(t1.status, t1.text).toBe(201);
    expect(t1.json.hlc).toMatch(/Z-[0-9A-F]{4}-server-/);
    txnId = t1.json.id;
    firstHlc = t1.json.hlc;
  });

  it("admin edits others' txn and the hlc advances", async () => {
    const t2 = await e.call("PATCH", `/v1/families/${s.F}/transactions/${txnId}`, {
      token: s.B,
      body: { amountPaisa: 90000, note: "edited by admin" },
    });
    expect(t2.status, t2.text).toBe(200);
    expect(t2.json.amountPaisa).toBe(90000);
    expect(t2.json.hlc > firstHlc).toBe(true);
  });

  it("viewer cannot list transactions", async () => {
    expect((await e.call("GET", `/v1/families/${s.F}/transactions`, { token: s.C })).status).toBe(403);
  });

  it("empty patch rejected", async () => {
    const res = await e.call("PATCH", `/v1/families/${s.F}/transactions/${txnId}`, { token: s.A, body: {} });
    expect(res.status).toBe(400);
  });

  it("deleting a transaction removes it from the list", async () => {
    const extra = await e.call("POST", `/v1/families/${s.F}/transactions`, {
      token: s.A,
      body: { type: "expense", amountPaisa: 100, occurredAt: now },
    });
    expect((await e.call("DELETE", `/v1/families/${s.F}/transactions/${extra.json.id}`, { token: s.A })).status).toBe(
      204,
    );
    const list = (await e.call("GET", `/v1/families/${s.F}/transactions`, { token: s.A })).json.items;
    expect(list.some((t: { id: string }) => t.id === extra.json.id)).toBe(false);
  });

  describe("ai without a key", () => {
    it("ask unavailable without key", async () => {
      const res = await e.call("POST", `/v1/families/${s.F}/ai/ask`, { token: s.A, body: { question: "hi" } });
      expect(res.status).toBe(503);
    });

    it("receipt unavailable without key", async () => {
      const res = await e.call("POST", `/v1/families/${s.F}/ai/receipt`, {
        token: s.A,
        body: { mediaType: "image/png", imageBase64: "A".repeat(200) },
      });
      expect(res.status).toBe(503);
    });

    it("offline quick parse works", async () => {
      const parsed = await e.call("POST", `/v1/families/${s.F}/ai/parse`, {
        token: s.A,
        body: { text: "আজ বাজারে ৮৫০ টাকা" },
      });
      expect(parsed.status, parsed.text).toBe(200);
      expect(parsed.json.drafts[0]?.amountPaisa).toBe(85000);
    });
  });
});
