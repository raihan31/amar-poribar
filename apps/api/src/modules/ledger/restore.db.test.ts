import { describe, expect, it } from "vitest";
import { buildTestApp, FIXED_NOW, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

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

const DAY = 24 * 3600_000;
const txn = { type: "expense", amountPaisa: 50_000, occurredAt: "2026-01-10T06:00:00.000Z" };

type Ctx = Awaited<ReturnType<typeof setup>>;
async function setup(
  db: Parameters<Parameters<typeof withTestDb>[0]>[0]["db"],
  sql: Parameters<Parameters<typeof withTestDb>[0]>[0]["sql"],
) {
  const t = await buildTestApp({ db, sql });
  const owner = await t.login("01711111111");
  const member = await t.login("01722222222");
  const other = await t.login("01733333333");
  const familyId = await createFamily(t, owner);
  await join(t, owner, familyId, member);
  await join(t, owner, familyId, other);
  const base = `/v1/families/${familyId}/transactions`;
  /** Creates a row as `who`, deletes it through the API, then back-dates the tombstone. */
  async function deleted(who: Tokens, daysAgo: number, extra: Record<string, unknown> = {}) {
    const c = await t.app.inject({ method: "POST", url: base, headers: t.as(who), payload: { ...txn, ...extra } });
    const id = c.json<{ id: string }>().id;
    const d = await t.app.inject({ method: "DELETE", url: `${base}/${id}`, headers: t.as(who) });
    expect(d.statusCode).toBe(204);
    const at = new Date(FIXED_NOW.getTime() - daysAgo * DAY).toISOString();
    await sql`update ledger.transactions set deleted_at = ${at} where id = ${id}`;
    return id;
  }
  return { t, owner, member, other, familyId, base, deleted, sql };
}
export type { Ctx };

describe("restore transaction (db)", () => {
  it("restore within 30 days returns the row to lists", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, member, base, deleted } = await setup(db, sql);
      const id = await deleted(member, 29);
      const res = await t.app.inject({ method: "POST", url: `${base}/${id}/restore`, headers: t.as(member) });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ deletedAt: string | null }>().deletedAt).toBeNull();
      const list = await t.app.inject({ method: "GET", url: base, headers: t.as(member) });
      expect(list.json<{ items: { id: string }[] }>().items.map((r) => r.id)).toContain(id);
      await t.close();
    });
  });

  it("restore after 30 days returns 410", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, member, base, deleted } = await setup(db, sql);
      const id = await deleted(member, 31);
      const res = await t.app.inject({ method: "POST", url: `${base}/${id}/restore`, headers: t.as(member) });
      expect(res.statusCode).toBe(410);
      expect(res.json<{ error: { code: string } }>().error.code).toBe("restore_window_passed");
      await t.close();
    });
  });

  it("member cannot restore another member's deletion", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, member, other, owner, base, deleted } = await setup(db, sql);
      const id = await deleted(member, 1);
      const res = await t.app.inject({ method: "POST", url: `${base}/${id}/restore`, headers: t.as(other) });
      expect(res.statusCode).toBe(403);
      const admin = await t.app.inject({ method: "POST", url: `${base}/${id}/restore`, headers: t.as(owner) });
      expect(admin.statusCode).toBe(200);
      await t.close();
    });
  });

  it("restore of a row that is not deleted returns 404", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, member, base } = await setup(db, sql);
      const c = await t.app.inject({ method: "POST", url: base, headers: t.as(member), payload: txn });
      const res = await t.app.inject({
        method: "POST",
        url: `${base}/${c.json<{ id: string }>().id}/restore`,
        headers: t.as(member),
      });
      expect(res.statusCode).toBe(404);
      await t.close();
    });
  });

  it("restore publishes TransactionUpdated kind restore", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, member, base, deleted } = await setup(db, sql);
      const id = await deleted(member, 2);
      await t.app.inject({ method: "POST", url: `${base}/${id}/restore`, headers: t.as(member) });
      const events = await sql<{ name: string; payload: Record<string, unknown> }[]>`
        select name, payload from platform.outbox where name = 'ledger.TransactionUpdated.v1'`;
      expect(events).toHaveLength(1);
      expect(events[0]!.payload).toMatchObject({ kind: "restore", transactionId: id });
      await t.close();
    });
  });
});
