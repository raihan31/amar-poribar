import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nowIso, openE2e, seedFamily, type E2e, type Res, type Seeded } from "../support/e2e.js";

let e: E2e;
let s: Seeded;
const { now } = nowIso();
const hl = (t: number, c: number, n: string) =>
  `${new Date(t).toISOString()}-${c.toString(16).toUpperCase().padStart(4, "0")}-${n}`;
const T0 = Date.now() - 60_000;
const base = { type: "expense", feePaisa: 0, occurredAt: now, source: "manual", isPrivate: false };
const s1 = randomUUID();
const s2 = randomUUID();
const priv = randomUUID();
const dup = randomUUID();
let restId: string;
let bazaarId: string;
let mark: string;

const sync = (token: string, node: string, cursor: string | null, transactions: unknown[]): Promise<Res> =>
  e.call("POST", `/v1/families/${s.F}/sync`, { token, body: { nodeId: node, cursor, changes: { transactions } } });
const ids = (r: Res) => (r.json.changes.transactions as { id: string }[]).map((t) => t.id);

beforeAll(async () => {
  e = await openE2e();
  s = await seedFamily(e, ["01710000007", "01810000007", "01910000007"]);
  bazaarId = s.cats.find((c) => c.key === "bazaar")!.id;
  const t1 = await e.call("POST", `/v1/families/${s.F}/transactions`, {
    token: s.A,
    body: { type: "expense", amountPaisa: 90000, occurredAt: now, categoryId: bazaarId },
  });
  restId = t1.json.id;
});
afterAll(() => e.dispose());

describe("sync (e2e)", () => {
  it("push applies 3 and rejects a duplicate trxId, a foreign category and garbage", async () => {
    const r = await sync(s.A, "phoneA", null, [
      { ...base, id: s1, amountPaisa: 1000, note: "v1", hlc: hl(T0, 0, "phoneA") },
      { ...base, id: s2, amountPaisa: 2000, trxId: "TRX123", categoryId: bazaarId, hlc: hl(T0, 1, "phoneA") },
      { ...base, id: priv, amountPaisa: 3000, isPrivate: true, hlc: hl(T0, 2, "phoneA") },
      { ...base, id: dup, amountPaisa: 4000, trxId: "TRX123", hlc: hl(T0, 3, "phoneA") },
      { ...base, id: randomUUID(), amountPaisa: 5000, categoryId: randomUUID(), hlc: hl(T0, 4, "phoneA") },
      { id: "garbage" },
    ]);
    expect(r.status, r.text).toBe(200);
    expect(r.json.applied).toBe(3);
    expect(
      (r.json.rejected as { reason: string }[])
        .map((x) => x.reason)
        .sort()
        .join(),
    ).toBe("duplicate_trx_id,invalid,unknown_reference");
  });

  it("B receives pushed rows and REST-made rows, but not A's private one, with a numeric cursor", async () => {
    const r = await sync(s.B, "phoneB", null, []);
    const got = ids(r);
    expect(got).toContain(s1);
    expect(got).toContain(s2);
    expect(got).not.toContain(priv);
    expect(got).toContain(restId);
    expect(r.json.cursor).toMatch(/^\d+$/);
    mark = r.json.cursor;
  });

  it("an older edit does not overwrite a newer one, and the newer one is pulled", async () => {
    await sync(s.B, "phoneB", mark, [
      { ...base, id: s1, amountPaisa: 7777, note: "B newer", hlc: hl(T0 + 5000, 0, "phoneB") },
    ]);
    const r = await sync(s.A, "phoneA", mark, [
      { ...base, id: s1, amountPaisa: 1111, note: "A older", hlc: hl(T0 + 1000, 0, "phoneA") },
    ]);
    expect(r.json.applied).toBe(0);
    expect(
      (r.json.changes.transactions as { id: string; amountPaisa: number }[]).some(
        (t) => t.id === s1 && t.amountPaisa === 7777,
      ),
    ).toBe(true);
  });

  it("replaying the same change applies nothing", async () => {
    const again = await sync(s.B, "phoneB", null, [
      { ...base, id: s1, amountPaisa: 7777, note: "B newer", hlc: hl(T0 + 5000, 0, "phoneB") },
    ]);
    expect(again.json.applied).toBe(0);
  });

  it("an entry with an HLC older than the cursor is still delivered", async () => {
    const old = randomUUID();
    await sync(s.B, "phoneB", null, [{ ...base, id: old, amountPaisa: 42, hlc: hl(T0 - 86_400_000, 0, "phoneB") }]);
    const r = await sync(s.A, "phoneA", mark, []);
    expect(ids(r)).toContain(old);
  });

  it("a tombstone reaches the other device and the row leaves the REST list", async () => {
    await sync(s.B, "phoneB", null, [
      {
        ...base,
        id: s2,
        amountPaisa: 2000,
        trxId: "TRX123",
        categoryId: bazaarId,
        deletedAt: now,
        hlc: hl(T0 + 9000, 0, "phoneB"),
      },
    ]);
    const r = await sync(s.A, "phoneA", mark, []);
    expect(
      (r.json.changes.transactions as { id: string; deletedAt: string | null }[]).some(
        (t) => t.id === s2 && t.deletedAt,
      ),
    ).toBe(true);
    const list = (await e.call("GET", `/v1/families/${s.F}/transactions`, { token: s.A })).json.items;
    expect(list.some((t: { id: string }) => t.id === s2)).toBe(false);
  });

  it("a far-future clock is rejected", async () => {
    const r = await sync(s.A, "evil", null, [
      { ...base, id: randomUUID(), amountPaisa: 1, hlc: hl(Date.now() + 3 * 86_400_000, 0, "evil") },
    ]);
    expect(r.status, r.text).toBe(400);
    expect(r.json.error.code).toBe("clock_drift");
  });

  it("a REST edit sorts after a phone clock running ahead", async () => {
    const ahead = randomUUID();
    const aheadHlc = hl(Date.now() + 3_600_000, 0, "phoneA");
    await sync(s.A, "phoneA", null, [{ ...base, id: ahead, amountPaisa: 100, hlc: aheadHlc }]);
    const edited = await e.call("PATCH", `/v1/families/${s.F}/transactions/${ahead}`, {
      token: s.A,
      body: { amountPaisa: 200 },
    });
    expect(edited.status, edited.text).toBe(200);
    expect(edited.json.hlc > aheadHlc).toBe(true);
  });
});
