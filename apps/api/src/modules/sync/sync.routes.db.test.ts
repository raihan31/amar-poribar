import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

type Row = Record<string, unknown>;
type SyncBody = {
  cursor: string;
  more: boolean;
  applied: number;
  rejected: { id: string | null; reason: string }[];
  changes: { transactions: Row[] };
};

async function createFamily(t: TestApp, tokens: Tokens): Promise<string> {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(tokens),
    payload: { name: "রহিম পরিবার" },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function join(t: TestApp, owner: Tokens, familyId: string, who: Tokens, role = "member") {
  const invite = await t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/invites`,
    headers: t.as(owner),
    payload: { role },
  });
  const res = await t.app.inject({
    method: "POST",
    url: `/v1/invites/${invite.json<{ token: string }>().token}/accept`,
    headers: t.as(who),
  });
  expect(res.statusCode).toBe(200);
}

const hlc = (offsetMs: number, counter = 0, node = "dev1") =>
  `${new Date(Date.now() + offsetMs).toISOString()}-${counter.toString(16).toUpperCase().padStart(4, "0")}-${node}`;

const row = (over: Row = {}): Row => ({
  id: randomUUID(),
  type: "expense",
  amountPaisa: 50_000,
  occurredAt: "2026-01-10T06:00:00.000Z",
  hlc: hlc(-60_000),
  ...over,
});

async function sync(
  t: TestApp,
  who: Tokens,
  familyId: string,
  transactions: Row[] = [],
  cursor: string | null = null,
  expectStatus = 200,
) {
  const res = await t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/sync`,
    headers: t.as(who),
    payload: { nodeId: "dev1", cursor, changes: { transactions } },
  });
  expect(res.statusCode, res.body).toBe(expectStatus);
  return res;
}

async function setup(t: TestApp) {
  const owner = await t.login("01711111111");
  const familyId = await createFamily(t, owner);
  return { owner, familyId };
}

describe("sync routes (db)", () => {
  it("requires auth", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const res = await t.app.inject({ method: "POST", url: "/v1/families/x/sync", payload: {} });
      expect(res.statusCode).toBe(401);
    });
  });

  it("first sync returns everything", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const a = row();
      const b = row();
      const push = (await sync(t, owner, familyId, [a, b])).json<SyncBody>();
      expect(push.applied).toBe(2);
      const first = (await sync(t, owner, familyId)).json<SyncBody>();
      expect(first.changes.transactions.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
      expect(first.more).toBe(false);
    });
  });

  it("second sync with returned cursor returns nothing", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      await sync(t, owner, familyId, [row()]);
      const first = (await sync(t, owner, familyId)).json<SyncBody>();
      const second = (await sync(t, owner, familyId, [], first.cursor)).json<SyncBody>();
      expect(second.changes.transactions).toEqual([]);
      expect(second.cursor).toBe(first.cursor);
    });
  });

  it("older HLC loses to newer", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const id = randomUUID();
      await sync(t, owner, familyId, [row({ id, amountPaisa: 100, hlc: hlc(-1000) })]);
      const older = (await sync(t, owner, familyId, [row({ id, amountPaisa: 999, hlc: hlc(-5000) })])).json<SyncBody>();
      expect(older.applied).toBe(0);
      const newer = (await sync(t, owner, familyId, [row({ id, amountPaisa: 200, hlc: hlc(-500) })])).json<SyncBody>();
      expect(newer.applied).toBe(1);
      const all = (await sync(t, owner, familyId)).json<SyncBody>();
      expect(all.changes.transactions).toHaveLength(1);
      expect(all.changes.transactions[0]).toMatchObject({ id, amountPaisa: 200 });
    });
  });

  it("same push twice is idempotent", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const r = row();
      const one = (await sync(t, owner, familyId, [r])).json<SyncBody>();
      const two = (await sync(t, owner, familyId, [r], one.cursor)).json<SyncBody>();
      expect(one.applied).toBe(1);
      expect(two.applied).toBe(0);
      expect(two.rejected).toEqual([]);
      expect(two.changes.transactions).toEqual([]);
    });
  });

  it("clock drift over 24h is rejected", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const res = await sync(t, owner, familyId, [row({ hlc: hlc(25 * 3600 * 1000) })], null, 400);
      expect(res.body).toContain("clock_drift");
      const all = (await sync(t, owner, familyId)).json<SyncBody>();
      expect(all.changes.transactions).toEqual([]);
    });
  });

  it("duplicate trxId is rejected for one row only", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const first = row({ trxId: "AB12CD34" });
      const dup = row({ trxId: "AB12CD34" });
      const other = row();
      const res = (await sync(t, owner, familyId, [first, dup, other])).json<SyncBody>();
      expect(res.applied).toBe(2);
      expect(res.rejected).toEqual([{ id: dup.id, reason: "duplicate_trx_id" }]);
    });
  });

  it("private rows return only to creator", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const member = await t.login("01722222222");
      await join(t, owner, familyId, member);
      const secret = row({ isPrivate: true });
      const shared = row();
      await sync(t, owner, familyId, [secret, shared]);
      const ownerView = (await sync(t, owner, familyId)).json<SyncBody>();
      expect(ownerView.changes.transactions.map((r) => r.id)).toContain(secret.id);
      const memberView = (await sync(t, member, familyId)).json<SyncBody>();
      expect(memberView.changes.transactions.map((r) => r.id)).toEqual([shared.id]);
    });
  });

  it("viewer cannot sync", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const viewer = await t.login("01733333333");
      await join(t, owner, familyId, viewer, "viewer");
      await sync(t, viewer, familyId, [], null, 403);
    });
  });

  it("more=true paging with 1200 rows", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const rows = Array.from({ length: 1200 }, (_, i) => row({ hlc: hlc(-60_000, i) }));
      for (let i = 0; i < rows.length; i += 500) {
        const res = (await sync(t, owner, familyId, rows.slice(i, i + 500))).json<SyncBody>();
        expect(res.rejected).toEqual([]);
      }
      const sizes: number[] = [];
      const seen = new Set<unknown>();
      let cursor: string | null = null;
      for (let guard = 0; guard < 5; guard++) {
        const page: SyncBody = (await sync(t, owner, familyId, [], cursor)).json<SyncBody>();
        sizes.push(page.changes.transactions.length);
        page.changes.transactions.forEach((r) => seen.add(r.id));
        cursor = page.cursor;
        if (!page.more) break;
      }
      expect(sizes).toEqual([500, 500, 200]);
      expect(seen.size).toBe(1200);
    });
    // 1200 rows are applied one by one, so on a busy machine this needs more than the 30s default.
  }, 180_000);
});
