import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type OwnedTestDb } from "../../../tests/support/db-test.js";
import { EventBus } from "../../platform/events/bus.js";
import { MemoryObjectStorage } from "../../platform/storage/memory.js";
import type { LedgerDeps } from "./app/deps.js";
import { getMonthTotals, getRangeTotals } from "./app/month-totals.js";
import { onFamilyDeleted } from "./app/on-family-deleted.js";
import {
  assertRefs,
  countTransactions,
  getCategoriesByKeys,
  getLastActivity,
  listAccounts,
  listCategories,
} from "./app/queries.js";
import { seedDefaults } from "./app/seed-defaults.js";
import type { Viewer } from "./domain/viewer.js";
import { visibleTo } from "./infra/visibility.js";
import { accounts, categories, transactions } from "./schema.js";

let t: OwnedTestDb;
let deps: LedgerDeps;
const ME = randomUUID();
const OTHER = randomUUID();
let family: string;

beforeAll(async () => {
  t = await createTestDb();
  deps = {
    db: t.db,
    bus: new EventBus(),
    families: {
      getUserLabels: async (ids: readonly string[]) => new Map(ids.map((i) => [i, i === ME ? "আমি" : "অন্য"])),
    },
  } as unknown as LedgerDeps;
});
afterAll(async () => {
  await t.drop();
});
beforeEach(async () => {
  await t.truncateAll();
  family = randomUUID();
});

const day = new Date("2026-01-10T06:00:00.000Z");
async function add(over: Partial<typeof transactions.$inferInsert> = {}) {
  const [row] = await t.db
    .insert(transactions)
    .values({
      familyId: family,
      type: "expense",
      amountPaisa: 1000,
      occurredAt: day,
      createdBy: ME,
      paidByUserId: ME,
      ...over,
    })
    .returning();
  return row!;
}
const visibleIds = async (viewer: Viewer) =>
  (await t.db.select({ id: transactions.id }).from(transactions).where(visibleTo(family, viewer))).map((r) => r.id);

describe("visibleTo", () => {
  it("viewer sees own private entries", async () => {
    const mine = await add({ isPrivate: true, createdBy: ME });
    expect(await visibleIds({ userId: ME })).toContain(mine.id);
  });

  it("viewer does not see others private entries", async () => {
    const theirs = await add({ isPrivate: true, createdBy: OTHER });
    const shared = await add({ createdBy: OTHER });
    const ids = await visibleIds({ userId: ME });
    expect(ids).not.toContain(theirs.id);
    expect(ids).toContain(shared.id);
  });

  it("family viewer excludes all private entries", async () => {
    const mine = await add({ isPrivate: true, createdBy: ME });
    const shared = await add();
    const ids = await visibleIds("family");
    expect(ids).toEqual([shared.id]);
    expect(ids).not.toContain(mine.id);
  });

  it("soft deleted rows are never visible", async () => {
    const gone = await add({ deletedAt: new Date() });
    expect(await visibleIds({ userId: ME })).not.toContain(gone.id);
    expect(await visibleIds("family")).not.toContain(gone.id);
  });

  it("does not leak another family's rows", async () => {
    await add({ familyId: randomUUID() });
    expect(await visibleIds({ userId: ME })).toEqual([]);
  });
});

describe("totals", () => {
  it("month totals include fee in expense", async () => {
    await add({ amountPaisa: 10_000, feePaisa: 185 });
    await add({ type: "income", amountPaisa: 50_000 });
    const totals = await getMonthTotals(deps, family, { userId: ME }, "2026-01");
    expect(totals.expensePaisa).toBe(10_185);
    expect(totals.incomePaisa).toBe(50_000);
  });

  it("byMember groups by payer", async () => {
    await add({ amountPaisa: 300, paidByUserId: ME });
    await add({ amountPaisa: 200, paidByUserId: OTHER, createdBy: OTHER });
    await add({ amountPaisa: 100, paidByUserId: ME });
    const totals = await getMonthTotals(deps, family, { userId: ME }, "2026-01");
    expect(totals.byMember).toEqual([
      { id: ME, name: "আমি", totalPaisa: 400 },
      { id: OTHER, name: "অন্য", totalPaisa: 200 },
    ]);
  });

  it("range totals apply the viewer and split by category", async () => {
    await add({ amountPaisa: 500 });
    await add({ amountPaisa: 700, isPrivate: true, createdBy: OTHER });
    await add({ type: "income", amountPaisa: 900 });
    const end = new Date(day.getTime() + 86_400_000);
    const r = await getRangeTotals(deps, family, { userId: ME }, day, end);
    expect(r).toMatchObject({ incomePaisa: 900, expensePaisa: 500 });
    expect(r.byCategory).toHaveLength(1);
    const fam = await getRangeTotals(deps, family, "family", day, end);
    expect(fam.expensePaisa).toBe(500);
  });
});

describe("catalog queries", () => {
  it("assertRefs rejects another family's category", async () => {
    const otherFamily = randomUUID();
    await t.db.transaction((tx) => seedDefaults(tx, otherFamily, null));
    await t.db.transaction((tx) => seedDefaults(tx, family, null));
    const [foreign] = await t.db.select().from(categories).where(eq(categories.familyId, otherFamily)).limit(1);
    const [foreignAcc] = await t.db.select().from(accounts).where(eq(accounts.familyId, otherFamily)).limit(1);
    const [own] = await t.db.select().from(categories).where(eq(categories.familyId, family)).limit(1);
    await expect(assertRefs(deps.db, family, { categoryId: foreign!.id })).rejects.toMatchObject({
      status: 400,
      code: "invalid_category",
    });
    await expect(assertRefs(deps.db, family, { accountId: foreignAcc!.id })).rejects.toMatchObject({
      status: 400,
      code: "invalid_account",
    });
    await expect(assertRefs(deps.db, family, { categoryId: own!.id })).resolves.toBeUndefined();
  });

  it("lists categories and accounts with filters", async () => {
    await t.db.transaction((tx) => seedDefaults(tx, family, null));
    const all = await listCategories(deps, family, { includeHidden: true });
    await t.db.update(categories).set({ isHidden: true }).where(eq(categories.id, all[0]!.id));
    expect(await listCategories(deps, family, { includeHidden: false })).toHaveLength(all.length - 1);
    expect(await listCategories(deps, family, { includeHidden: true })).toHaveLength(all.length);
    const [acc] = await listAccounts(deps, family, { includeArchived: true });
    await t.db.update(accounts).set({ archivedAt: new Date() }).where(eq(accounts.id, acc!.id));
    expect(await listAccounts(deps, family, { includeArchived: false })).toHaveLength(1);
    const keyed = await getCategoriesByKeys(deps, family, [all[1]!.key, "nope"]);
    expect(keyed.map((c) => c.key)).toEqual([all[1]!.key]);
  });

  it("counts transactions and reports last activity", async () => {
    expect(await getLastActivity(deps, family)).toBeNull();
    expect(await countTransactions(deps, family)).toBe(0);
    await add();
    await add({ deletedAt: new Date() });
    expect(await countTransactions(deps, family)).toBe(2);
    expect(await getLastActivity(deps, family)).toBeInstanceOf(Date);
  });
});

describe("onFamilyDeleted", () => {
  it("removes every row and the receipt objects of that family only", async () => {
    const other = randomUUID();
    await t.db.transaction((tx) => seedDefaults(tx, family, null));
    await t.db.transaction((tx) => seedDefaults(tx, other, null));
    await add();
    await add({ familyId: other });
    const storage = new MemoryObjectStorage();
    await storage.putObject(`receipt/${family}/a.jpg`, new Uint8Array([1]), "image/jpeg");
    await storage.putObject(`receipt/${other}/b.jpg`, new Uint8Array([1]), "image/jpeg");
    await onFamilyDeleted(t.db, storage, family);
    expect(await countTransactions(deps, family)).toBe(0);
    expect(await listCategories(deps, family, { includeHidden: true })).toHaveLength(0);
    expect(await countTransactions(deps, other)).toBe(1);
    expect(await storage.head(`receipt/${family}/a.jpg`)).toBeNull();
    expect(await storage.head(`receipt/${other}/b.jpg`)).not.toBeNull();
    await onFamilyDeleted(t.db, storage, family);
  });
});
