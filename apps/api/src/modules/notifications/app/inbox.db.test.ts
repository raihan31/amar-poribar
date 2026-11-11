import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { buildTestApp, type Tokens } from "../../../../tests/support/app-test.js";
import { withTestDb } from "../../../../tests/support/db-test.js";

type T = Awaited<ReturnType<typeof buildTestApp>>;
type Item = { id: string; seq: number; readAt: string | null; createdAt: string };
type List = { items: Item[]; nextCursor: string | null; unread: number };

const userIdOf = (u: Tokens) =>
  (JSON.parse(Buffer.from(u.accessToken.split(".")[1] ?? "", "base64url").toString()) as { sub: string }).sub;

const call = (t: T, u: Tokens, method: "GET" | "POST" | "DELETE", url: string, payload?: object) =>
  t.app.inject({ method, url, headers: t.as(u), ...(payload ? { payload } : {}) });

async function seed(t: { sql: Sql }, userId: string, n: number, base = "2026-01-15T06:00:00.000Z") {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const at = new Date(Date.parse(base) + i * 1000).toISOString();
    const rows = await t.sql`
      insert into notifications.inbox_items (user_id, kind, title, body, speech_text, created_at)
      values (${userId}, 'system', ${"t" + i}, 'b', 's', ${at}::timestamptz)
      returning id`;
    ids.push(String(rows[0]?.id));
  }
  return ids;
}

describe("inbox (db)", () => {
  it("paginates 3 pages stable order", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      // Same created_at for several rows to prove the (created_at, id) tiebreak.
      await sql`insert into notifications.inbox_items (user_id, kind, title, body, speech_text, created_at)
        select ${userIdOf(u)}, 'system', 't', 'b', 's', '2026-01-15T06:00:00.123456Z'::timestamptz from generate_series(1, 5)`;
      await seed({ sql }, userIdOf(u), 1, "2026-01-16T06:00:00.000Z");
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const res = await call(t, u, "GET", `/v1/inbox?limit=2${cursor ? `&cursor=${cursor}` : ""}`);
        expect(res.statusCode).toBe(200);
        const body: List = res.json();
        seen.push(...body.items.map((i) => i.id));
        cursor = body.nextCursor;
        pages++;
      } while (cursor && pages < 10);
      expect(pages).toBe(3);
      expect(new Set(seen).size).toBe(6);
      const all = (await call(t, u, "GET", "/v1/inbox")).json<List>();
      expect(all.items.map((i) => i.id)).toEqual(seen);
      expect(all.nextCursor).toBeNull();
      expect((await call(t, u, "GET", "/v1/inbox?limit=51")).statusCode).toBe(400);
      await t.close();
    });
  });

  it("mark read by ids", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      const ids = await seed({ sql }, userIdOf(u), 3);
      const res = await call(t, u, "POST", "/v1/inbox/read", { ids: [ids[0], ids[1]] });
      expect(res.json()).toEqual({ updated: 2 });
      expect((await call(t, u, "GET", "/v1/inbox")).json<List>().unread).toBe(1);
      expect((await call(t, u, "POST", "/v1/inbox/read", {})).statusCode).toBe(400);
      expect((await call(t, u, "POST", "/v1/inbox/read", { ids: [ids[0]], all: true })).statusCode).toBe(400);
      await t.close();
    });
  });

  it("mark all", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      await seed({ sql }, userIdOf(u), 3);
      expect((await call(t, u, "POST", "/v1/inbox/read", { all: true })).json()).toEqual({ updated: 3 });
      const list = (await call(t, u, "GET", "/v1/inbox")).json<List>();
      expect(list.unread).toBe(0);
      expect(list.items.every((i) => i.readAt !== null)).toBe(true);
      await t.close();
    });
  });

  it("delete own only", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const a = await t.login("01712345678");
      const b = await t.login("01812345678");
      const [mine] = await seed({ sql }, userIdOf(a), 2);
      const [theirs] = await seed({ sql }, userIdOf(b), 1);
      expect((await call(t, a, "DELETE", `/v1/inbox/${theirs}`)).statusCode).toBe(404);
      expect((await call(t, a, "DELETE", `/v1/inbox/${mine}`)).statusCode).toBe(204);
      expect((await call(t, a, "GET", "/v1/inbox")).json<List>().items).toHaveLength(1);
      expect((await call(t, a, "DELETE", "/v1/inbox")).statusCode).toBe(204);
      expect((await call(t, a, "GET", "/v1/inbox")).json<List>().items).toHaveLength(0);
      expect((await call(t, b, "GET", "/v1/inbox")).json<List>().items).toHaveLength(1);
      await t.close();
    });
  });

  it("changes returns after seq", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      await seed({ sql }, userIdOf(u), 25);
      const recent = (await call(t, u, "GET", "/v1/inbox/changes")).json<{ items: Item[]; lastSeq: number }>();
      expect(recent.items).toHaveLength(20);
      const seqs = recent.items.map((i) => i.seq);
      expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
      const mid = seqs[14] as number;
      const after = (await call(t, u, "GET", `/v1/inbox/changes?afterSeq=${mid}`)).json<{
        items: Item[];
        lastSeq: number;
      }>();
      expect(after.items.map((i) => i.seq)).toEqual(seqs.filter((s) => s > mid));
      expect(after.lastSeq).toBe(recent.lastSeq);
      const none = (await call(t, u, "GET", `/v1/inbox/changes?afterSeq=${recent.lastSeq}`)).json();
      expect(none).toEqual({ items: [], lastSeq: recent.lastSeq });
      await t.close();
    });
  });

  it("unread count", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      const ids = await seed({ sql }, userIdOf(u), 4);
      expect((await call(t, u, "GET", "/v1/inbox?limit=1")).json<List>().unread).toBe(4);
      await call(t, u, "POST", "/v1/inbox/read", { ids: [ids[0]] });
      expect((await call(t, u, "GET", "/v1/inbox?limit=1")).json<List>().unread).toBe(3);
      await t.close();
    });
  });

  it("cannot see another user's items", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const a = await t.login("01712345678");
      const b = await t.login("01812345678");
      const [theirs] = await seed({ sql }, userIdOf(b), 2);
      const list = (await call(t, a, "GET", "/v1/inbox")).json<List>();
      expect(list).toEqual({ items: [], nextCursor: null, unread: 0 });
      expect((await call(t, a, "GET", "/v1/inbox/changes")).json()).toEqual({ items: [], lastSeq: 0 });
      expect((await call(t, a, "POST", "/v1/inbox/read", { ids: [theirs] })).json()).toEqual({ updated: 0 });
      expect((await call(t, a, "POST", "/v1/inbox/read", { all: true })).json()).toEqual({ updated: 0 });
      expect((await call(t, b, "GET", "/v1/inbox")).json<List>().unread).toBe(2);
      await t.close();
    });
  });
});
