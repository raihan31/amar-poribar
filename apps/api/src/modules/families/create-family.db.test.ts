import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

type Tokens = Awaited<ReturnType<TestApp["login"]>>;

function create(t: TestApp, tokens: Tokens, name: string) {
  return t.app.inject({ method: "POST", url: "/v1/families", headers: t.as(tokens), payload: { name } });
}

describe("create-family (db)", () => {
  it("create family makes the caller owner", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const tokens = await t.login("01711111111");
      const res = await create(t, tokens, "রহিম পরিবার");
      expect(res.statusCode).toBe(201);
      const id = res.json<{ id: string }>().id;
      const rows = await sql<{ role: string }[]>`select role from families.family_members where family_id = ${id}`;
      expect(rows.map((r) => r.role)).toEqual(["owner"]);
      await t.close();
    });
  });

  it("create family publishes FamilyCreated once", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const tokens = await t.login("01711111111");
      const me = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(tokens) });
      const userId = me.json<{ user: { id: string } }>().user.id;
      const id = (await create(t, tokens, "Rahim")).json<{ id: string }>().id;
      const events = await sql<
        { payload: { familyId: string; ownerUserId: string; name: string; createdAt: string } }[]
      >`select payload from platform.outbox where name = 'families.FamilyCreated.v1'`;
      expect(events.length).toBe(1);
      expect(events[0]!.payload).toMatchObject({ familyId: id, ownerUserId: userId, name: "Rahim" });
      expect(Number.isNaN(Date.parse(events[0]!.payload.createdAt))).toBe(false);
      await t.close();
    });
  });

  it("status defaults to active and memberLimit to 3", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const tokens = await t.login("01711111111");
      const res = await create(t, tokens, "Rahim");
      expect(res.json()).toMatchObject({ status: "active", memberLimit: 3 });
      const rows = await sql<
        { suspended_at: Date | null; suspended_reason: string | null }[]
      >`select suspended_at, suspended_reason from families.families`;
      expect(rows[0]).toEqual({ suspended_at: null, suspended_reason: null });
      await t.close();
    });
  });

  it("family name is trimmed and limited to 80", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const tokens = await t.login("01711111111");
      const ok = await create(t, tokens, "  Rahim  ");
      expect(ok.statusCode).toBe(201);
      expect(ok.json<{ name: string }>().name).toBe("Rahim");
      expect((await create(t, tokens, "x".repeat(81))).statusCode).toBe(400);
      expect((await create(t, tokens, "   ")).statusCode).toBe(400);
      await t.close();
    });
  });
});
