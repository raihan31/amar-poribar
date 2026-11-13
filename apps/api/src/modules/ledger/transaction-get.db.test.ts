import { describe, expect, it } from "vitest";
import { buildTestApp, FIXED_NOW, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

const DAY = 24 * 3600_000;
const txn = { type: "expense", amountPaisa: 50_000, occurredAt: "2026-01-10T06:00:00.000Z", note: "bajar" };
type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

/** The free plan allows 3 members, so a family has either a second plain member or a viewer, not both. */
async function setup({ db, sql }: Db, withViewer = false) {
  const t = await buildTestApp({ db, sql });
  const owner = await t.login("01711111111");
  const member = await t.login("01722222222");
  const other = await t.login("01733333333");
  const viewer = other;
  const fam = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  const familyId = fam.json<{ id: string }>().id;
  for (const [who, role] of [
    [member, "member"],
    [other, withViewer ? "viewer" : "member"],
  ] as [Tokens, string][]) {
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
    expect(res.statusCode, res.body).toBe(200);
  }
  const base = `/v1/families/${familyId}/transactions`;
  const create = async (who: Tokens, extra: Record<string, unknown> = {}) => {
    const c = await t.app.inject({ method: "POST", url: base, headers: t.as(who), payload: { ...txn, ...extra } });
    expect(c.statusCode).toBe(201);
    return c.json<{ id: string }>().id;
  };
  const get = (who: Tokens, id: string) => t.app.inject({ method: "GET", url: `${base}/${id}`, headers: t.as(who) });
  return { t, owner, member, other, viewer, base, create, get };
}

describe("get one transaction (db)", () => {
  it("returns canEdit true for own entry", async () => {
    await withTestDb(async (d) => {
      const { t, member, create, get } = await setup(d);
      const id = await create(member, { trxId: "ABC123" });
      const res = await get(member, id);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        id,
        trxId: "ABC123",
        note: "bajar",
        feePaisa: 0,
        source: "manual",
        attachmentUrl: null,
        splitGroupId: null,
        toAccountId: null,
        canEdit: true,
        canDelete: true,
      });
      expect(typeof res.json<{ createdAt: string }>().createdAt).toBe("string");
      await t.close();
    });
  });

  it("returns canEdit false for another member's entry", async () => {
    await withTestDb(async (d) => {
      const { t, member, other, owner, create, get } = await setup(d);
      const id = await create(member);
      const res = await get(other, id);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ canEdit: false, canDelete: false });
      expect((await get(owner, id)).json()).toMatchObject({ canEdit: true, canDelete: true });
      await t.close();
    });
  });

  it("private entry of another user is 404", async () => {
    await withTestDb(async (d) => {
      const { t, member, other, create, get } = await setup(d);
      const id = await create(member, { isPrivate: true });
      expect((await get(other, id)).statusCode).toBe(404);
      expect((await get(member, id)).statusCode).toBe(200);
      await t.close();
    });
  });

  it("deleted entry returns 410 with restorableUntil", async () => {
    await withTestDb(async (d) => {
      const { t, member, other, create, get, base } = await setup(d);
      const id = await create(member);
      await t.app.inject({ method: "DELETE", url: `${base}/${id}`, headers: t.as(member) });
      const at = new Date(FIXED_NOW.getTime() - 2 * DAY);
      await d.sql`update ledger.transactions set deleted_at = ${at.toISOString()} where id = ${id}`;
      const res = await get(member, id);
      expect(res.statusCode).toBe(410);
      const body = res.json<{ error: { code: string; details: { restorableUntil: string } } }>();
      expect(body.error.code).toBe("transaction_deleted");
      expect(body.error.details.restorableUntil).toBe(new Date(at.getTime() + 30 * DAY).toISOString());
      // Another plain member could not restore it, so for them it is gone.
      expect((await get(other, id)).statusCode).toBe(404);
      // Past the window nobody can restore it.
      const old = new Date(FIXED_NOW.getTime() - 31 * DAY).toISOString();
      await d.sql`update ledger.transactions set deleted_at = ${old} where id = ${id}`;
      expect((await get(member, id)).statusCode).toBe(404);
      await t.close();
    });
  });

  it("viewer is 403", async () => {
    await withTestDb(async (d) => {
      const { t, member, viewer, create, get } = await setup(d, true);
      const id = await create(member);
      expect((await get(viewer, id)).statusCode).toBe(403);
      await t.close();
    });
  });
});
