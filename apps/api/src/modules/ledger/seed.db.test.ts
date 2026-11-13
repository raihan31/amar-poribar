import { describe, expect, it } from "vitest";
import { CATEGORY_ICON_IDS } from "@amar-poribar/shared";
import { buildTestApp } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { seedDefaults } from "./app/seed-defaults.js";

async function setup(db: Parameters<Parameters<typeof withTestDb>[0]>[0]["db"], sql: never) {
  const t = await buildTestApp({ db, sql });
  const owner = await t.login("01711111111");
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  expect(res.statusCode).toBe(201);
  const me = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(owner) });
  return { t, familyId: res.json<{ id: string }>().id, userId: me.json<{ user: { id: string } }>().user.id };
}

describe("ledger seed on FamilyCreated (db)", () => {
  it("creating a family seeds 28 categories and 2 accounts", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, familyId } = await setup(db, sql as never);
      const cats = await sql<{ icon: string }[]>`select icon from ledger.categories where family_id = ${familyId}`;
      expect(cats).toHaveLength(28);
      const ids = new Set<string>(CATEGORY_ICON_IDS);
      for (const c of cats) expect(ids.has(c.icon)).toBe(true);
      const accs = await sql`select 1 from ledger.accounts where family_id = ${familyId}`;
      expect(accs).toHaveLength(2);
      await t.close();
    });
  });

  it("seeding twice changes nothing", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, familyId, userId } = await setup(db, sql as never);
      await db.transaction((tx) => seedDefaults(tx, familyId, userId));
      expect(await sql`select 1 from ledger.categories where family_id = ${familyId}`).toHaveLength(28);
      expect(await sql`select 1 from ledger.accounts where family_id = ${familyId}`).toHaveLength(2);
      await t.close();
    });
  });

  it("bKash account belongs to the owner", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, familyId, userId } = await setup(db, sql as never);
      const rows = await sql<{ type: string; owner_user_id: string | null }[]>`
        select type, owner_user_id from ledger.accounts where family_id = ${familyId} order by type`;
      expect(rows.find((r) => r.type === "bkash")?.owner_user_id).toBe(userId);
      expect(rows.find((r) => r.type === "cash")?.owner_user_id).toBeNull();
      await t.close();
    });
  });
});
