import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { EventBus } from "../../platform/events/bus.js";
import { transferOwnership } from "./app/transfer-ownership.js";

type Tokens = Awaited<ReturnType<TestApp["login"]>>;

async function userId(t: TestApp, who: Tokens) {
  const me = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(who) });
  return me.json<{ user: { id: string } }>().user.id;
}

async function join(t: TestApp, owner: Tokens, familyId: string, phone: string, role: "admin" | "member") {
  const who = await t.login(phone);
  const invite = await t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/invites`,
    headers: t.as(owner),
    payload: { role },
  });
  const ok = await t.app.inject({
    method: "POST",
    url: `/v1/invites/${invite.json().token}/accept`,
    headers: t.as(who),
  });
  expect(ok.statusCode).toBe(200);
  return { tokens: who, id: await userId(t, who) };
}

async function setup(t: TestApp) {
  const owner = await t.login("01711111111");
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  const familyId = res.json<{ id: string }>().id;
  const admin = await join(t, owner, familyId, "01722222222", "admin");
  const member = await join(t, owner, familyId, "01733333333", "member");
  return { owner, ownerId: await userId(t, owner), familyId, admin, member };
}

const transfer = (t: TestApp, who: Tokens, familyId: string, toUserId: string) =>
  t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/transfer-ownership`,
    headers: t.as(who),
    payload: { toUserId },
  });

async function roles(t: TestApp, familyId: string, caller: Tokens) {
  const res = await t.app.inject({ method: "GET", url: `/v1/families/${familyId}/members`, headers: t.as(caller) });
  return res.json<{ userId: string; role: string }[]>();
}

describe("transfer ownership (db)", () => {
  it("owner transfers to admin", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const s = await setup(t);
      const res = await transfer(t, s.owner, s.familyId, s.admin.id);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ familyId: s.familyId, owner: s.admin.id });
      const list = await roles(t, s.familyId, s.admin.tokens);
      expect(list.find((m) => m.userId === s.admin.id)?.role).toBe("owner");
      expect(list.find((m) => m.userId === s.ownerId)?.role).toBe("admin");
      await t.close();
    });
  });

  it("transfer to member is rejected", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const s = await setup(t);
      const res = await transfer(t, s.owner, s.familyId, s.member.id);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("target_not_admin");
      const missing = await transfer(t, s.owner, s.familyId, "00000000-0000-4000-8000-000000000000");
      expect(missing.statusCode).toBe(404);
      await t.close();
    });
  });

  it("non owner cannot transfer", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const s = await setup(t);
      const res = await transfer(t, s.admin.tokens, s.familyId, s.admin.id);
      expect(res.statusCode).toBe(403);
      const outsider = await t.login("01744444444");
      expect((await transfer(t, outsider, s.familyId, s.admin.id)).statusCode).toBe(404);
      await t.close();
    });
  });

  it("exactly one owner after transfer", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const s = await setup(t);
      await transfer(t, s.owner, s.familyId, s.admin.id);
      // The old owner is now an admin and cannot transfer again.
      expect((await transfer(t, s.owner, s.familyId, s.admin.id)).statusCode).toBe(403);
      // Back again by the new owner.
      expect((await transfer(t, s.admin.tokens, s.familyId, s.ownerId)).statusCode).toBe(200);
      const list = await roles(t, s.familyId, s.owner);
      expect(list.filter((m) => m.role === "owner")).toHaveLength(1);
      expect(list.find((m) => m.role === "owner")?.userId).toBe(s.ownerId);
      await t.close();
    });
  });

  it("event published once", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const s = await setup(t);
      await transfer(t, s.owner, s.familyId, s.admin.id);
      await transfer(t, s.owner, s.familyId, s.admin.id); // rejected, must not publish
      const rows = await sql`select payload from platform.outbox where name = 'families.OwnershipTransferred.v1'`;
      expect(rows).toHaveLength(1);
      expect(rows[0]!.payload).toEqual({
        familyId: s.familyId,
        fromUserId: s.ownerId,
        toUserId: s.admin.id,
        by: "owner",
      });
      await t.close();
    });
  });

  it("staff may transfer to any member and sets by staff", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const s = await setup(t);
      const deps = { db, bus: new EventBus(), clock: () => new Date(), publicWebUrl: "x", identity: {} as never };
      const out = await transferOwnership(deps, {
        familyId: s.familyId,
        toUserId: s.member.id,
        actor: { kind: "staff", id: "staff-1" },
      });
      expect(out).toEqual({ familyId: s.familyId, owner: s.member.id });
      const list = await roles(t, s.familyId, s.member.tokens);
      expect(list.filter((m) => m.role === "owner").map((m) => m.userId)).toEqual([s.member.id]);
      expect(list.find((m) => m.userId === s.ownerId)?.role).toBe("admin");
      const rows = await sql`select payload from platform.outbox where name = 'families.OwnershipTransferred.v1'`;
      expect(rows[0]!.payload).toMatchObject({ by: "staff", fromUserId: s.ownerId });
      await t.close();
    });
  });
});
