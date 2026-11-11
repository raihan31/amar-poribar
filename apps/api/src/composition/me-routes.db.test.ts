import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp } from "../../tests/support/app-test.js";
import { withTestDb } from "../../tests/support/db-test.js";

type Tokens = Awaited<ReturnType<TestApp["login"]>>;

async function createFamily(t: TestApp, tokens: Tokens, name = "রহিম পরিবার") {
  const res = await t.app.inject({ method: "POST", url: "/v1/families", headers: t.as(tokens), payload: { name } });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

describe("GET /v1/me (db)", () => {
  it("me returns families with role and memberCount", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const guest = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const invite = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/invites`,
        headers: t.as(owner),
        payload: {},
      });
      await t.app.inject({
        method: "POST",
        url: `/v1/invites/${invite.json().token}/accept`,
        headers: t.as(guest),
      });
      const res = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(owner) });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user.phone).toBe("+8801711111111");
      expect(body.families).toEqual([
        { id: familyId, name: "রহিম পরিবার", role: "owner", status: "active", memberLimit: 3, memberCount: 2 },
      ]);
      const guestMe = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(guest) });
      expect(guestMe.json().families[0]).toMatchObject({ id: familyId, role: "member", memberCount: 2 });
      await t.close();
    });
  });

  it("me includes needsAcceptance true for a new user", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01733333333");
      const res = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(u) });
      expect(res.json().consents).toEqual({ policyVersion: "2026-11-01", needsAcceptance: true });
      expect(res.json().families).toEqual([]);
      await t.close();
    });
  });
});
