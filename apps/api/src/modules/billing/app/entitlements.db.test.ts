import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "../../../../tests/support/app-test.js";
import { withTestDb } from "../../../../tests/support/db-test.js";
import { HttpError } from "../../../platform/errors.js";
import { createEntitlements, type SubscriptionSnapshot } from "./entitlements.js";

const staff = randomUUID();

describe("entitlements (db)", () => {
  it("defaults to free", async () => {
    await withTestDb(async ({ db }) => {
      const svc = createEntitlements({ db });
      const e = await svc.entitlements(randomUUID());
      expect(e).toEqual({
        planId: "free",
        state: "none",
        membersMax: 3,
        aiEntriesMonth: 100,
        historyMonths: 6,
        features: {
          receiptVision: false,
          ask: false,
          exportBeyondCsv: false,
          multiCurrency: false,
          remittancePlanner: false,
        },
        periodEnd: null,
      });
    });
  });

  it("override raises ai entries", async () => {
    await withTestDb(async ({ db }) => {
      const svc = createEntitlements({ db });
      const fam = randomUUID();
      await svc.setOverride(fam, { aiEntriesMonth: 500, reason: "goodwill", setBy: staff });
      const e = await svc.entitlements(fam);
      expect(e.aiEntriesMonth).toBe(500);
      expect(e.membersMax).toBe(3);
    });
  });

  it("expired falls back", async () => {
    await withTestDb(async ({ db }) => {
      const sub: SubscriptionSnapshot = { planId: "plus", state: "expired", periodEnd: "2026-01-01T00:00:00.000Z" };
      const svc = createEntitlements({ db, subscriptionOf: async () => sub });
      const e = await svc.entitlements(randomUUID());
      expect(e).toMatchObject({ planId: "free", state: "expired", membersMax: 3, periodEnd: null });
      expect(e.features.ask).toBe(false);
      const active = createEntitlements({ db, subscriptionOf: async () => ({ ...sub, state: "active" }) });
      expect(await active.entitlements(randomUUID())).toMatchObject({ planId: "plus", membersMax: 8 });
    });
  });

  it("cache busted on change", async () => {
    await withTestDb(async ({ db, sql }) => {
      let now = new Date("2026-01-15T06:00:00.000Z");
      const svc = createEntitlements({ db, clock: () => now });
      const fam = randomUUID();
      expect((await svc.entitlements(fam)).aiEntriesMonth).toBe(100);
      await sql`insert into billing.family_overrides (family_id, ai_entries_month, reason, set_by)
                values (${fam}, 7, 'direct', ${staff})`;
      expect((await svc.entitlements(fam)).aiEntriesMonth).toBe(100); // cached
      svc.invalidate(fam); // what billing.SubscriptionChanged.v1 does
      expect((await svc.entitlements(fam)).aiEntriesMonth).toBe(7);
      await svc.setOverride(fam, { aiEntriesMonth: 9, reason: "again", setBy: staff });
      expect((await svc.entitlements(fam)).aiEntriesMonth).toBe(9);
      await sql`update billing.family_overrides set ai_entries_month = 11 where family_id = ${fam}`;
      now = new Date(now.getTime() + 61_000);
      expect((await svc.entitlements(fam)).aiEntriesMonth).toBe(11); // TTL expiry
    });
  });

  it("assertFeature throws 402 with feature", async () => {
    await withTestDb(async ({ db }) => {
      const svc = createEntitlements({ db });
      const err = await svc.assertFeature(randomUUID(), "ask").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect(err).toMatchObject({ status: 402, code: "plan_required", details: { feature: "ask" } });
    });
  });

  it("member capacity boundary (3 ok, 4th blocked)", async () => {
    await withTestDb(async ({ db }) => {
      const svc = createEntitlements({ db });
      const fam = randomUUID();
      await expect(svc.assertMemberCapacity(fam, 2)).resolves.toBeUndefined(); // adding the 3rd
      const err = await svc.assertMemberCapacity(fam, 3).catch((e: unknown) => e); // adding the 4th
      expect(err).toMatchObject({ status: 409, code: "plan_member_limit" });
    });
  });

  it("GET /v1/families/:familyId/entitlements for members only", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01712345678");
      const other = await t.login("01812345678");
      const created = await t.app.inject({
        method: "POST",
        url: "/v1/families",
        headers: t.as(owner),
        payload: { name: "রহিম পরিবার" },
      });
      const familyId = created.json<{ id: string }>().id;
      const res = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/entitlements`,
        headers: t.as(owner),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ planId: "free", membersMax: 3, aiEntriesMonth: 100 });
      const denied = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/entitlements`,
        headers: t.as(other),
      });
      expect(denied.statusCode).toBe(404);
      await t.close();
    });
  });
});
