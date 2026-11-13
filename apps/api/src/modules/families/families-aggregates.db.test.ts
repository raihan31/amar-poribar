import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { createAggregates } from "./app/aggregates.js";

async function createFamily(t: TestApp, owner: Tokens, name = "রহিম পরিবার") {
  const res = await t.app.inject({ method: "POST", url: "/v1/families", headers: t.as(owner), payload: { name } });
  return res.json<{ id: string }>().id;
}
const invite = (t: TestApp, who: Tokens, familyId: string, payload: object = {}) =>
  t.app.inject({ method: "POST", url: `/v1/families/${familyId}/invites`, headers: t.as(who), payload });
const accept = (t: TestApp, who: Tokens, token: string) =>
  t.app.inject({ method: "POST", url: `/v1/invites/${token}/accept`, headers: t.as(who) });

type Sql = Parameters<Parameters<typeof withTestDb>[0]>[0]["sql"];

async function aggregates(t: TestApp, sql: Sql) {
  const users = await sql<{ id: string; phone: string; name: string | null }[]>`
    select id, phone, name from identity.users`;
  const byId = new Map(users.map((u) => [u.id, u]));
  const identity = {
    getUserBasics: async (id: string) => {
      const u = byId.get(id);
      return u ? { id: u.id, name: u.name, phone: u.phone } : null;
    },
    maskPhone: (p: string) => `•••${p.slice(-3)}`,
  };
  return createAggregates({ db: t.db, identity: identity as never, lastActivity: async () => null });
}

describe("families-aggregates (db)", () => {
  it("invite beyond limit returns plan_member_limit", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const joiner = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      await sql`update families.families set member_limit = 1 where id = ${familyId}`;
      const created = await invite(t, owner, familyId);
      expect(created.statusCode).toBe(409);
      expect(created.json().error.code).toBe("plan_member_limit");
      expect(created.json().error.details.limit).toBe(1);
      // Accepting an invite that was created before the limit dropped is blocked too.
      await sql`update families.families set member_limit = 3 where id = ${familyId}`;
      const token = (await invite(t, owner, familyId)).json().token as string;
      await sql`update families.families set member_limit = 1 where id = ${familyId}`;
      const res = await accept(t, joiner, token);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("plan_member_limit");
      expect(res.json().error.details.limit).toBe(1);
      await t.close();
    });
  });

  it("subscription event updates the limit", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const [before] = await sql`select member_limit, ai_quota_month from families.families where id = ${familyId}`;
      expect(before).toMatchObject({ member_limit: 3, ai_quota_month: 100 });
      const payload = { familyId, planKey: "plus", memberLimit: 8, aiQuotaMonth: 500, historyMonths: 24 };
      await sql`insert into platform.outbox (id, name, payload, occurred_at, family_id)
        values (gen_random_uuid(), 'billing.SubscriptionChanged.v1', ${JSON.stringify(payload)}::jsonb, now(), ${familyId})`;
      await t.drain();
      const [after] =
        await sql`select plan, member_limit, ai_quota_month from families.families where id = ${familyId}`;
      expect(after).toMatchObject({ plan: "plus", member_limit: 8, ai_quota_month: 500 });
      await t.close();
    });
  });

  it("aggregates mask phones", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const joiner = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const token = (await invite(t, owner, familyId)).json().token as string;
      await accept(t, joiner, token);
      const agg = await aggregates(t, sql);
      const list = await agg.listFamilySummaries({});
      expect(list.rows).toHaveLength(1);
      expect(list.rows[0]).toMatchObject({
        familyId,
        name: "রহিম পরিবার",
        memberCount: 2,
        plan: "free",
        status: "active",
        lastActiveAt: null,
        noOwner: false,
      });
      expect(list.rows[0]!.ownerPhoneMasked).toMatch(/^•••\d{3}$/);
      const one = await agg.getFamilyAggregate(familyId);
      expect(one!.members).toHaveLength(2);
      for (const m of one!.members) expect(m.phoneMasked).toMatch(/^•••\d{3}$/);
      const json = JSON.stringify([list, one]);
      expect(json).not.toContain("01711111111");
      expect(json).not.toContain("8801711111111");
      expect(json).not.toContain("1722222222");
      expect(await agg.countFamilies()).toBe(1);
      expect(await agg.getFamilyAggregate("00000000-0000-0000-0000-000000000000")).toBeNull();
      await t.close();
    });
  });

  it("list filters by query, status and plan and pages by cursor", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const a = await createFamily(t, owner, "Alpha");
      await createFamily(t, owner, "Beta");
      await createFamily(t, owner, "Gamma");
      await sql`update families.families set plan = 'plus', status = 'suspended' where id = ${a}`;
      const agg = await aggregates(t, sql);
      expect((await agg.listFamilySummaries({ query: "alp" })).rows.map((r) => r.name)).toEqual(["Alpha"]);
      expect((await agg.listFamilySummaries({ plan: "plus" })).rows).toHaveLength(1);
      expect((await agg.listFamilySummaries({ status: "suspended" })).rows).toHaveLength(1);
      const p1 = await agg.listFamilySummaries({ limit: 2 });
      expect(p1.rows).toHaveLength(2);
      expect(p1.nextCursor).toBeTruthy();
      const p2 = await agg.listFamilySummaries({ limit: 2, cursor: p1.nextCursor! });
      expect(p2.rows).toHaveLength(1);
      expect(p2.nextCursor).toBeNull();
      const ids = new Set([...p1.rows, ...p2.rows].map((r) => r.familyId));
      expect(ids.size).toBe(3);
      await t.close();
    });
  });

  it("family without owner is listed", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      await createFamily(t, owner, "অন্য পরিবার");
      await sql`delete from families.family_members where family_id = ${familyId} and role = 'owner'`;
      const agg = await aggregates(t, sql);
      const none = await agg.listFamiliesWithoutOwner();
      expect(none.map((f) => f.familyId)).toEqual([familyId]);
      const row = (await agg.listFamilySummaries({})).rows.find((r) => r.familyId === familyId)!;
      expect(row).toMatchObject({ noOwner: true, ownerPhoneMasked: null, memberCount: 0 });
      await t.close();
    });
  });
});
