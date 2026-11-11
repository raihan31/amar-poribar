import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

type Tokens = Awaited<ReturnType<TestApp["login"]>>;

async function setup(t: TestApp) {
  const owner = await t.login("01711111111");
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  return { owner, familyId: res.json<{ id: string }>().id };
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
  return who;
}

describe("family and members routes (db)", () => {
  it("members list hides phone from members", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const member = await join(t, owner, familyId, "01722222222", "member");
      const res = await t.app.inject({ method: "GET", url: `/v1/families/${familyId}/members`, headers: t.as(member) });
      expect(res.statusCode).toBe(200);
      const list = res.json<
        {
          userId: string;
          name: string | null;
          displayName: string;
          phone: string | null;
          isYou: boolean;
          joinedAt: string;
        }[]
      >();
      expect(list).toHaveLength(2);
      for (const m of list) {
        expect(m.phone).toBeNull();
        expect(m.joinedAt).toBeTruthy();
        expect(m.displayName).toBeTruthy();
        expect(m.displayName).not.toContain("01711111111");
      }
      expect(list.filter((m) => m.isYou)).toHaveLength(1);
      await t.close();
    });
  });

  it("members list shows phone to admins", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const admin = await join(t, owner, familyId, "01722222222", "admin");
      for (const caller of [owner, admin]) {
        const res = await t.app.inject({
          method: "GET",
          url: `/v1/families/${familyId}/members`,
          headers: t.as(caller),
        });
        const phones = res.json<{ phone: string | null }[]>().map((m) => m.phone);
        expect(phones.sort()).toEqual(["+8801711111111", "+8801722222222"]);
      }
      await t.close();
    });
  });

  it("members list uses the name as displayName when set", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      await t.app.inject({ method: "PATCH", url: "/v1/me", headers: t.as(owner), payload: { name: "রহিম" } });
      const res = await t.app.inject({ method: "GET", url: `/v1/families/${familyId}/members`, headers: t.as(owner) });
      expect(res.json()[0]).toMatchObject({ name: "রহিম", displayName: "রহিম", role: "owner", isYou: true });
      await t.close();
    });
  });

  it("get family returns memberCount and myRole", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const member = await join(t, owner, familyId, "01722222222", "member");
      const res = await t.app.inject({ method: "GET", url: `/v1/families/${familyId}`, headers: t.as(member) });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: familyId, name: "রহিম পরিবার", memberCount: 2, myRole: "member" });
      const stranger = await t.login("01799999999");
      const no = await t.app.inject({ method: "GET", url: `/v1/families/${familyId}`, headers: t.as(stranger) });
      expect(no.statusCode).toBe(404);
      await t.close();
    });
  });

  it("patch family renames for admin and rejects member", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const admin = await join(t, owner, familyId, "01722222222", "admin");
      const member = await join(t, owner, familyId, "01733333333", "member");
      const patch = (who: Tokens, payload: object) =>
        t.app.inject({ method: "PATCH", url: `/v1/families/${familyId}`, headers: t.as(who), payload });
      const ok = await patch(admin, { name: "  নতুন নাম  " });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({ id: familyId, name: "নতুন নাম", myRole: "admin", memberCount: 3 });
      const denied = await patch(member, { name: "হ্যাক" });
      expect(denied.statusCode).toBe(403);
      expect((await patch(owner, { name: "" })).statusCode).toBe(400);
      expect((await patch(owner, { name: "ঠিক", plan: "pro" })).statusCode).toBe(400);
      const rows = await sql<{ name: string }[]>`select name from families.families where id = ${familyId}`;
      expect(rows[0]!.name).toBe("নতুন নাম");
      await t.close();
    });
  });
});
