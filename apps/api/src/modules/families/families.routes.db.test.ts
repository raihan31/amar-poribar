import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

async function userId(t: TestApp, tokens: Awaited<ReturnType<TestApp["login"]>>): Promise<string> {
  const me = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(tokens) });
  const body = me.json<{ user: { id: string } }>();
  return body.user.id;
}

async function createFamily(t: TestApp, tokens: Awaited<ReturnType<TestApp["login"]>>) {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(tokens),
    payload: { name: "রহিম পরিবার" },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

describe("families routes (db)", () => {
  it("create family seeds owner membership", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const rows = await sql<
        { role: string }[]
      >`select role from families.family_members where family_id = ${familyId}`;
      expect(rows.map((r) => r.role)).toEqual(["owner"]);
      const events = await sql`select name from platform.outbox where name = 'families.FamilyCreated.v1'`;
      expect(events.length).toBe(1);
      const me = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(owner) });
      expect(me.json().families).toEqual([{ id: familyId, name: "রহিম পরিবার", role: "owner" }]);
      await t.close();
    });
  });

  it("non-member gets 404 from requireRole", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const stranger = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const res = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/members`,
        headers: t.as(stranger),
      });
      expect(res.statusCode).toBe(404);
      await t.close();
    });
  });

  it("viewer fails member-level requireRole with 403", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const viewer = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const invite = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/invites`,
        headers: t.as(owner),
        payload: { role: "viewer" },
      });
      await t.app.inject({
        method: "POST",
        url: `/v1/invites/${invite.json().token}/accept`,
        headers: t.as(viewer),
      });
      // Creating an invite needs admin; a viewer is a member with too little role.
      const res = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/invites`,
        headers: t.as(viewer),
        payload: {},
      });
      expect(res.statusCode).toBe(403);
      const list = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/members`,
        headers: t.as(viewer),
      });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toHaveLength(2);
      await t.close();
    });
  });

  it("invite is single use", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const first = await t.login("01722222222");
      const second = await t.login("01733333333");
      const familyId = await createFamily(t, owner);
      const invite = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/invites`,
        headers: t.as(owner),
        payload: {},
      });
      const token = invite.json().token as string;
      const ok = await t.app.inject({ method: "POST", url: `/v1/invites/${token}/accept`, headers: t.as(first) });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toEqual({ familyId, role: "member" });
      const again = await t.app.inject({ method: "POST", url: `/v1/invites/${token}/accept`, headers: t.as(second) });
      expect(again.statusCode).toBe(404);
      expect(await userId(t, first)).toBeTruthy();
      await t.close();
    });
  });

  it("phone-bound invite rejects another phone", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const other = await t.login("01733333333");
      const invited = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const invite = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/invites`,
        headers: t.as(owner),
        payload: { phone: "01722222222" },
      });
      const token = invite.json().token as string;
      const wrong = await t.app.inject({ method: "POST", url: `/v1/invites/${token}/accept`, headers: t.as(other) });
      expect(wrong.statusCode).toBe(403);
      const right = await t.app.inject({ method: "POST", url: `/v1/invites/${token}/accept`, headers: t.as(invited) });
      expect(right.statusCode).toBe(200);
      await t.close();
    });
  });
});
