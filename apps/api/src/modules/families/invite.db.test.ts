import { describe, expect, it } from "vitest";
import { buildTestApp, FIXED_NOW, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

const DAY = 24 * 60 * 60 * 1000;

async function createFamily(t: TestApp, owner: Tokens) {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  return res.json<{ id: string }>().id;
}

const invite = (t: TestApp, who: Tokens, familyId: string, payload: object = {}) =>
  t.app.inject({ method: "POST", url: `/v1/families/${familyId}/invites`, headers: t.as(who), payload });
const accept = (t: TestApp, who: Tokens, token: string) =>
  t.app.inject({ method: "POST", url: `/v1/invites/${token}/accept`, headers: t.as(who) });
const preview = (t: TestApp, token: string) => t.app.inject({ method: "GET", url: `/v1/invites/${token}` });
const listInvites = (t: TestApp, who: Tokens, familyId: string) =>
  t.app.inject({ method: "GET", url: `/v1/families/${familyId}/invites`, headers: t.as(who) });

describe("invites (db)", () => {
  it("preview shows valid invite details", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const created = await invite(t, owner, familyId, { phone: "01722222222" });
      expect(created.statusCode).toBe(201);
      expect(created.json().link).toBe(`http://localhost:3000/join/${created.json().token}`);
      const res = await preview(t, created.json().token);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toMatchObject({ familyName: "রহিম পরিবার", memberCount: 1, role: "member", state: "valid" });
      expect(typeof body.invitedBy.name).toBe("string");
      expect(body.forPhoneMasked).toBeTruthy();
      expect(JSON.stringify(body)).not.toContain("01722222222");
      expect(JSON.stringify(body)).not.toContain("01711111111");
      const missing = await preview(t, "nope");
      expect(missing.statusCode).toBe(404);
      expect(missing.json().error.code).toBe("invite_not_found");
      await t.close();
    });
  });

  it("preview returns expired after 7 days", async () => {
    await withTestDb(async ({ db, sql }) => {
      let now = FIXED_NOW;
      const t = await buildTestApp({ db, sql, clock: () => now });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const token = (await invite(t, owner, familyId)).json().token as string;
      now = new Date(FIXED_NOW.getTime() + 7 * DAY + 1000);
      expect((await preview(t, token)).json().state).toBe("expired");
      const other = await t.login("01722222222");
      const res = await accept(t, other, token);
      expect(res.statusCode).toBe(410);
      expect(res.json().error.code).toBe("invite_expired");
      await t.close();
    });
  });

  it("preview returns used after accept", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const joiner = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const token = (await invite(t, owner, familyId)).json().token as string;
      expect((await accept(t, joiner, token)).statusCode).toBe(200);
      expect((await preview(t, token)).json().state).toBe("used");
      await t.close();
    });
  });

  it("accept adds member and publishes MemberJoined", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const joiner = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const token = (await invite(t, owner, familyId, { role: "viewer" })).json().token as string;
      const res = await accept(t, joiner, token);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ familyId, role: "viewer" });
      const members = await sql`select role from families.family_members where family_id = ${familyId}`;
      expect(members).toHaveLength(2);
      const ev = await sql<{ payload: { invitedBy: string; role: string } }[]>`
        select payload from platform.outbox where name = 'families.MemberJoined.v1'`;
      expect(ev).toHaveLength(1);
      expect(ev[0]!.payload.role).toBe("viewer");
      expect(ev[0]!.payload.invitedBy).toBeTruthy();
      await t.close();
    });
  });

  it("accept twice by same user is idempotent", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const joiner = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const token = (await invite(t, owner, familyId)).json().token as string;
      await accept(t, joiner, token);
      const again = await accept(t, joiner, token);
      expect(again.statusCode).toBe(200);
      expect(again.json()).toEqual({ familyId, role: "member", alreadyMember: true });
      const ev = await sql`select 1 from platform.outbox where name = 'families.MemberJoined.v1'`;
      expect(ev).toHaveLength(1);
      await t.close();
    });
  });

  it("accept by another user returns invite_used", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const a = await t.login("01722222222");
      const b = await t.login("01733333333");
      const familyId = await createFamily(t, owner);
      const token = (await invite(t, owner, familyId)).json().token as string;
      await accept(t, a, token);
      const res = await accept(t, b, token);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("invite_used");
      await t.close();
    });
  });

  it("wrong phone returns invite_wrong_phone", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const other = await t.login("01733333333");
      const familyId = await createFamily(t, owner);
      const token = (await invite(t, owner, familyId, { phone: "01722222222" })).json().token as string;
      const res = await accept(t, other, token);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("invite_wrong_phone");
      await t.close();
    });
  });

  it("member limit blocks accept", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const joiner = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      await sql`update families.families set member_limit = 1 where id = ${familyId}`;
      const token = (await invite(t, owner, familyId)).json().token as string;
      const res = await accept(t, joiner, token);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("member_limit");
      expect(res.json().error.details.limit).toBe(1);
      await t.close();
    });
  });

  it("revoked invite cannot be accepted", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const joiner = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const created = (await invite(t, owner, familyId)).json();
      const list = await listInvites(t, owner, familyId);
      expect(list.statusCode).toBe(200);
      expect(list.json()).toHaveLength(1);
      expect(list.json()[0].token).toBe(created.token);
      const del = await t.app.inject({
        method: "DELETE",
        url: `/v1/families/${familyId}/invites/${list.json()[0].id}`,
        headers: t.as(owner),
      });
      expect(del.statusCode).toBe(204);
      expect((await preview(t, created.token)).json().state).toBe("revoked");
      const res = await accept(t, joiner, created.token);
      expect(res.statusCode).toBe(410);
      expect(res.json().error.code).toBe("invite_revoked");
      expect((await listInvites(t, owner, familyId)).json()).toHaveLength(0);
      await t.close();
    });
  });

  it("list hides tokens of invites created by someone else", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const admin = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const adminInvite = (await invite(t, owner, familyId, { role: "admin" })).json().token as string;
      await accept(t, admin, adminInvite);
      await invite(t, owner, familyId);
      const list = await listInvites(t, admin, familyId);
      expect(list.statusCode).toBe(200);
      expect(list.json()).toHaveLength(1);
      expect(list.json()[0].token).toBeUndefined();
      await t.close();
    });
  });

  it("invite role escalation is rejected", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const admin = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const adminInvite = (await invite(t, owner, familyId, { role: "admin" })).json().token as string;
      await accept(t, admin, adminInvite);
      const res = await invite(t, admin, familyId, { role: "admin" });
      expect(res.statusCode).toBe(403);
      await t.close();
    });
  });

  it("purge job deletes invites expired or revoked more than 30 days ago", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      for (let i = 0; i < 3; i++) await invite(t, owner, familyId);
      const rows = await sql<{ id: string }[]>`select id from families.family_invites order by id`;
      const old = new Date(FIXED_NOW.getTime() - 31 * DAY);
      await sql`update families.family_invites set expires_at = ${old.toISOString()}::timestamptz where id = ${rows[0]!.id}`;
      await sql`update families.family_invites set revoked_at = ${old.toISOString()}::timestamptz where id = ${rows[1]!.id}`;
      const { purgeInvites } = await import("./app/invites.js");
      await purgeInvites(db, FIXED_NOW);
      const left = await sql<{ id: string }[]>`select id from families.family_invites`;
      expect(left.map((r) => r.id)).toEqual([rows[2]!.id]);
      await t.close();
    });
  });
});
