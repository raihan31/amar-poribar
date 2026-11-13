import { describe, expect, it } from "vitest";
import { buildTestApp, FIXED_NOW, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { MemoryObjectStorage } from "../../platform/storage/memory.js";
import { storageKeys } from "../../platform/storage/keys.js";
import { purgeDeleted } from "./jobs.js";

async function createFamily(t: TestApp, tokens: Tokens): Promise<string> {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(tokens),
    payload: { name: "রহিম পরিবার" },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function join(t: TestApp, owner: Tokens, familyId: string, who: Tokens, role = "member") {
  const invite = await t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/invites`,
    headers: t.as(owner),
    payload: { role },
  });
  const res = await t.app.inject({
    method: "POST",
    url: `/v1/invites/${invite.json<{ token: string }>().token}/accept`,
    headers: t.as(who),
  });
  expect(res.statusCode).toBe(200);
}

const DAY = 24 * 3600_000;
const txn = { type: "expense", amountPaisa: 50_000, occurredAt: "2026-01-10T06:00:00.000Z" };

type Ctx = Awaited<ReturnType<typeof setup>>;
async function setup(
  db: Parameters<Parameters<typeof withTestDb>[0]>[0]["db"],
  sql: Parameters<Parameters<typeof withTestDb>[0]>[0]["sql"],
) {
  const t = await buildTestApp({ db, sql });
  const owner = await t.login("01711111111");
  const member = await t.login("01722222222");
  const other = await t.login("01733333333");
  const familyId = await createFamily(t, owner);
  await join(t, owner, familyId, member);
  await join(t, owner, familyId, other);
  const base = `/v1/families/${familyId}/transactions`;
  /** Creates a row as `who`, deletes it through the API, then back-dates the tombstone. */
  async function deleted(who: Tokens, daysAgo: number, extra: Record<string, unknown> = {}) {
    const c = await t.app.inject({ method: "POST", url: base, headers: t.as(who), payload: { ...txn, ...extra } });
    const id = c.json<{ id: string }>().id;
    const d = await t.app.inject({ method: "DELETE", url: `${base}/${id}`, headers: t.as(who) });
    expect(d.statusCode).toBe(204);
    const at = new Date(FIXED_NOW.getTime() - daysAgo * DAY).toISOString();
    await sql`update ledger.transactions set deleted_at = ${at} where id = ${id}`;
    return id;
  }
  return { t, owner, member, other, familyId, base, deleted, sql };
}
export type { Ctx };

describe("purge deleted transactions (db)", () => {
  it("purge removes rows older than 31 days only", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, member, familyId, deleted } = await setup(db, sql);
      const d30 = await deleted(member, 30);
      const d31 = await deleted(member, 31.5);
      const d32 = await deleted(member, 32);
      const storage = new MemoryObjectStorage();
      // Fake clock: "today" is FIXED_NOW; the 30 day row survives, the older ones go.
      expect(await purgeDeleted({ db, storage }, FIXED_NOW)).toBe(2);
      const left = await sql<{ id: string }[]>`select id from ledger.transactions where family_id = ${familyId}`;
      expect(left.map((r) => r.id)).toEqual([d30]);
      expect([d31, d32]).not.toContain(d30);
      expect(await purgeDeleted({ db, storage }, FIXED_NOW)).toBe(0);
      await t.close();
    });
  });

  it("purge deletes attachment objects", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, member, familyId, deleted } = await setup(db, sql);
      const old = await deleted(member, 40);
      const keep = await deleted(member, 5);
      const storage = new MemoryObjectStorage();
      await storage.putObject(storageKeys.receipt(familyId, old), new Uint8Array([1]), "image/jpeg");
      await storage.putObject(storageKeys.receipt(familyId, keep), new Uint8Array([1]), "image/jpeg");
      await purgeDeleted({ db, storage }, FIXED_NOW);
      expect(await storage.head(storageKeys.receipt(familyId, old))).toBeNull();
      expect(await storage.head(storageKeys.receipt(familyId, keep))).not.toBeNull();
      await t.close();
    });
  });

  it("purge never touches live rows", async () => {
    await withTestDb(async ({ db, sql }) => {
      const { t, member, base, familyId } = await setup(db, sql);
      const c = await t.app.inject({ method: "POST", url: base, headers: t.as(member), payload: txn });
      const id = c.json<{ id: string }>().id;
      await sql`update ledger.transactions set created_at = now() - interval '90 days' where id = ${id}`;
      const far = new Date(FIXED_NOW.getTime() + 400 * DAY);
      expect(await purgeDeleted({ db, storage: new MemoryObjectStorage() }, far)).toBe(0);
      const left = await sql`select id from ledger.transactions where family_id = ${familyId}`;
      expect(left).toHaveLength(1);
      await t.close();
    });
  });
});
