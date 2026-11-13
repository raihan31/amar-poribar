import { randomUUID } from "node:crypto";
import type { TransactionPage } from "@amar-poribar/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import type { Db } from "../../platform/db.js";
import { transactions } from "./schema.js";

async function me(t: TestApp, tokens: Tokens): Promise<string> {
  const res = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(tokens) });
  return res.json<{ user: { id: string } }>().user.id;
}

async function join(t: TestApp, owner: Tokens, familyId: string, who: Tokens, role: string) {
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

async function setup(db: Db, sql: Parameters<typeof buildTestApp>[0]["sql"]) {
  const t = await buildTestApp({ db, sql });
  const owner = await t.login("01711111111");
  const member = await t.login("01722222222");
  const viewer = await t.login("01733333333");
  const created = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  const familyId = created.json<{ id: string }>().id;
  await join(t, owner, familyId, member, "member");
  await join(t, owner, familyId, viewer, "viewer");
  const ownerId = await me(t, owner);
  const memberId = await me(t, member);
  const accounts = (
    await t.app.inject({ method: "GET", url: `/v1/families/${familyId}/accounts`, headers: t.as(owner) })
  ).json<{ id: string; type: string }[]>();
  const categories = (
    await t.app.inject({ method: "GET", url: `/v1/families/${familyId}/categories`, headers: t.as(owner) })
  ).json<{ id: string }[]>();
  const cash = accounts.find((a) => a.type === "cash")!.id;
  const bkash = accounts.find((a) => a.type === "bkash")!.id;
  const url = `/v1/families/${familyId}/transactions`;
  const get = (tokens: Tokens, query = "") =>
    t.app.inject({ method: "GET", url: `${url}${query}`, headers: t.as(tokens) });
  const page = async (tokens: Tokens, query = "") => {
    const res = await get(tokens, query);
    expect(res.statusCode).toBe(200);
    return res.json<TransactionPage>();
  };
  const insert = async (over: Partial<typeof transactions.$inferInsert> = {}) => {
    const [row] = await db
      .insert(transactions)
      .values({
        familyId,
        type: "expense",
        amountPaisa: 1000,
        occurredAt: new Date("2026-01-10T06:00:00.000Z"),
        createdBy: ownerId,
        paidByUserId: ownerId,
        ...over,
      })
      .returning();
    return row!;
  };
  return {
    t,
    owner,
    member,
    viewer,
    familyId,
    ownerId,
    memberId,
    cash,
    bkash,
    categoryId: categories[0]!.id,
    get,
    page,
    insert,
  };
}

/** 120 rows over 120 minutes; every third is the member's, every other one is on bKash. */
async function seed120(s: Awaited<ReturnType<typeof setup>>) {
  const base = new Date("2026-01-10T00:00:00.000Z").getTime();
  const ids: string[] = [];
  for (let i = 0; i < 120; i++) {
    const row = await s.insert({
      occurredAt: new Date(base + i * 60_000),
      paidByUserId: i % 3 === 0 ? s.memberId : s.ownerId,
      createdBy: i % 3 === 0 ? s.memberId : s.ownerId,
      accountId: i % 2 === 0 ? s.bkash : s.cash,
      categoryId: i % 4 === 0 ? s.categoryId : null,
      amountPaisa: 100 + i,
    });
    ids.push(row.id);
  }
  return ids;
}

describe("GET transactions (list, filters, cursor)", () => {
  it("first page returns 50 and a cursor", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      await seed120(s);
      const p = await s.page(s.owner);
      expect(p.items).toHaveLength(50);
      expect(p.nextCursor).toEqual(expect.any(String));
      const first = p.items[0]!;
      expect(first.dayKey).toBe("2026-01-10");
      expect(first.paidByName).toBeTruthy();
      expect(first).toHaveProperty("isMine");
      expect(first.hasAttachment).toBe(false);
      await s.t.close();
    });
  });

  it("three pages cover all 120 rows with no duplicates and no gaps", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      const all = await seed120(s);
      const seen: string[] = [];
      const sizes: number[] = [];
      let cursor: string | null = null;
      do {
        const p: TransactionPage = await s.page(s.owner, cursor ? `?cursor=${cursor}` : "");
        sizes.push(p.items.length);
        seen.push(...p.items.map((i) => i.id));
        cursor = p.nextCursor;
      } while (cursor);
      expect(sizes).toEqual([50, 50, 20]);
      expect(new Set(seen).size).toBe(120);
      expect(seen).toEqual([...all].reverse());
      await s.t.close();
    });
  });

  it("order is stable when many rows share occurredAt", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      const at = new Date("2026-01-10T06:00:00.000Z");
      for (let i = 0; i < 25; i++) await s.insert({ occurredAt: at });
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const p: TransactionPage = await s.page(s.owner, `?limit=10${cursor ? `&cursor=${cursor}` : ""}`);
        seen.push(...p.items.map((i) => i.id));
        cursor = p.nextCursor;
      } while (cursor);
      expect(new Set(seen).size).toBe(25);
      expect(seen).toEqual([...seen].sort().reverse());
      await s.t.close();
    });
  });

  it("filter by member", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      await seed120(s);
      const p = await s.page(s.owner, `?memberId=${s.memberId}&limit=100`);
      expect(p.items).toHaveLength(40);
      expect(p.items.every((i) => i.paidByUserId === s.memberId)).toBe(true);
      await s.t.close();
    });
  });

  it("filter by account and category together", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      await seed120(s);
      // i % 4 === 0 implies i % 2 === 0, so category rows are all on bKash.
      const both = await s.page(s.owner, `?accountId=${s.bkash}&categoryId=${s.categoryId}&limit=100`);
      expect(both.items).toHaveLength(30);
      const none = await s.page(s.owner, `?accountId=${s.cash}&categoryId=${s.categoryId}`);
      expect(none.items).toHaveLength(0);
      expect(none.nextCursor).toBeNull();
      expect(both.items[0]!.categoryNameBn).toBeTruthy();
      expect(both.items[0]!.accountName).toBe("bKash");
      await s.t.close();
    });
  });

  it("q matches note and counterparty case-insensitively", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      await s.insert({ note: "Rice from Shwapno" });
      await s.insert({ counterparty: "SHWAPNO Dhanmondi" });
      await s.insert({ note: "tea" });
      const p = await s.page(s.owner, "?q=shwapno");
      expect(p.items).toHaveLength(2);
      await s.t.close();
    });
  });

  it("q escapes percent", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      await s.insert({ note: "50% off" });
      await s.insert({ note: "500 taka" });
      await s.insert({ note: "a_b" });
      await s.insert({ note: "axb" });
      expect((await s.page(s.owner, `?q=${encodeURIComponent("%")}`)).items).toHaveLength(1);
      expect((await s.page(s.owner, `?q=${encodeURIComponent("a_b")}`)).items).toHaveLength(1);
      await s.t.close();
    });
  });

  it("month filter uses Asia/Dhaka boundaries", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      const nov = await s.insert({ occurredAt: new Date("2026-10-31T18:30:00.000Z") });
      const oct = await s.insert({ occurredAt: new Date("2026-10-31T17:59:59.000Z") });
      const november = await s.page(s.owner, "?month=2026-11");
      expect(november.items.map((i) => i.id)).toEqual([nov.id]);
      expect(november.items[0]!.dayKey).toBe("2026-11-01");
      const october = await s.page(s.owner, "?month=2026-10");
      expect(october.items.map((i) => i.id)).toEqual([oct.id]);
      const days = await s.page(s.owner, "?from=2026-11-01&to=2026-11-01");
      expect(days.items.map((i) => i.id)).toEqual([nov.id]);
      await s.t.close();
    });
  });

  it("range longer than 24 months is rejected", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      expect((await s.get(s.owner, "?from=2024-01-01&to=2026-01-01")).statusCode).toBe(400);
      expect((await s.get(s.owner, "?from=2024-01-01&to=2025-12-31")).statusCode).toBe(200);
      await s.t.close();
    });
  });

  it("private rows of others never appear in any page", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      for (let i = 0; i < 6; i++) {
        await s.insert({ createdBy: s.memberId, paidByUserId: s.memberId, isPrivate: i % 2 === 0 });
      }
      const mine = await s.insert({ isPrivate: true });
      const seen: { id: string; isMine: boolean }[] = [];
      let cursor: string | null = null;
      do {
        const p: TransactionPage = await s.page(s.owner, `?limit=2${cursor ? `&cursor=${cursor}` : ""}`);
        seen.push(...p.items);
        cursor = p.nextCursor;
      } while (cursor);
      expect(seen).toHaveLength(4);
      expect(seen.filter((r) => r.isMine).map((r) => r.id)).toEqual([mine.id]);
      await s.t.close();
    });
  });

  it("invalid cursor returns 400", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      for (const bad of [
        "garbage",
        Buffer.from("{}").toString("base64url"),
        Buffer.from(JSON.stringify({ t: "nope", id: randomUUID() })).toString("base64url"),
      ]) {
        const res = await s.get(s.owner, `?cursor=${bad}`);
        expect(res.statusCode).toBe(400);
        expect(res.json<{ error: { code: string } }>().error.code).toBe("invalid_cursor");
      }
      await s.t.close();
    });
  });

  it("limit above 100 is rejected", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      expect((await s.get(s.owner, "?limit=101")).statusCode).toBe(400);
      expect((await s.get(s.owner, "?limit=0")).statusCode).toBe(400);
      expect((await s.get(s.owner, "?limit=100")).statusCode).toBe(200);
      await s.t.close();
    });
  });

  it("viewer gets 403", async () => {
    await withTestDb(async ({ db, sql }) => {
      const s = await setup(db, sql);
      expect((await s.get(s.viewer)).statusCode).toBe(403);
      await s.t.close();
    });
  });
});
