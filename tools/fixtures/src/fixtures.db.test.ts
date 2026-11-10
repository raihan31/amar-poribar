import { describe, expect, it } from "vitest";
import { buildTestApp, FIXED_NOW } from "../../../apps/api/tests/support/app-test.js";
import { withTestDb } from "../../../apps/api/tests/support/db-test.js";
import {
  DEMO_FAMILY_NAME,
  DEMO_MEMBERS,
  FIXTURE_PHONES,
  injectClient,
  makeFamily,
  makeTransactions,
  makeUser,
  seedDemoFamily,
  type ApiClient,
} from "./index.js";

async function withApi<T>(fn: (api: ApiClient) => Promise<T>): Promise<T> {
  return withTestDb(async ({ db, sql }) => {
    const t = await buildTestApp({ db, sql });
    try {
      return await fn(injectClient(t.app, () => Promise.resolve(/\d{6}/.exec(t.fakes.sms.last()?.text ?? "")?.[0])));
    } finally {
      await t.close();
    }
  });
}

// The identity, families and ledger tables are created by the module moves (T-PLAT-23..25); until their
// migrations exist the fixtures have no API to talk to, exactly like the skipped login test in harness.test.ts.
const hasAppTables = await withTestDb(async ({ sql }) => {
  const r = await sql<{ users: string | null; ident: string | null; fam: string | null; cat: string | null }[]>`
    select to_regclass('public.users')::text as users, to_regclass('identity.users')::text as ident,
           coalesce(to_regclass('public.family_members')::text, to_regclass('families.family_members')::text) as fam,
           coalesce(to_regclass('public.categories')::text, to_regclass('ledger.categories')::text) as cat`;
  // Identity alone is not enough: the fixtures also need the families (T-PLAT-24) and ledger (T-PLAT-25) tables.
  return Boolean(r[0]?.users ?? r[0]?.ident) && Boolean(r[0]?.fam) && Boolean(r[0]?.cat);
});

describe.skipIf(!hasAppTables)("fixtures", () => {
  it("makeFamily creates seeded categories and cash account", async () => {
    await withApi(async (api) => {
      const owner = await makeUser(api, { phone: FIXTURE_PHONES.abbu });
      const family = await makeFamily(api, owner, { name: "পরীক্ষা পরিবার" });
      expect(family.categories.length).toBeGreaterThan(10);
      expect(family.accounts.some((a) => a.type === "cash")).toBe(true);
    });
  });

  it("makeTransactions is deterministic for a seed", async () => {
    const run = () =>
      withApi(async (api) => {
        const owner = await makeUser(api, { phone: FIXTURE_PHONES.abbu });
        const family = await makeFamily(api, owner, { name: "পরীক্ষা পরিবার" });
        const rows = await makeTransactions(api, owner.accessToken, family.id, 20, { seed: 7, endsAt: FIXED_NOW });
        // Ids and category/account ids are random per database; compare their positions in the lists.
        const catIdx = (id: string) => family.categories.findIndex((c) => c.id === id);
        const accIdx = (id: string) => family.accounts.findIndex((a) => a.id === id);
        return rows.map((r) => [
          r.type,
          r.amountPaisa,
          r.occurredAt,
          catIdx(r.categoryId),
          accIdx(r.accountId),
          r.isPrivate,
        ]);
      });
    const a = await run();
    const b = await run();
    expect(a).toEqual(b);
    expect(a.every((r) => Number.isInteger(r[1]))).toBe(true);
  });

  it("seed-dev is idempotent", async () => {
    await withApi(async (api) => {
      const first = await seedDemoFamily(api, { now: FIXED_NOW });
      const second = await seedDemoFamily(api, { now: FIXED_NOW });
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.family.id).toBe(first.family.id);
      const me = await api.get<{ families: { name: string }[] }>("/v1/me", { token: first.owner.accessToken });
      expect(me.body.families.filter((f) => f.name === DEMO_FAMILY_NAME)).toHaveLength(1);
      const members = await api.get<unknown[]>(`/v1/families/${first.family.id}/members`, {
        token: first.owner.accessToken,
      });
      expect(members.body).toHaveLength(DEMO_MEMBERS.length);
    });
  });
});
