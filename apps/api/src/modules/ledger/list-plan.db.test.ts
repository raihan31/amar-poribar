import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type OwnedTestDb } from "../../../tests/support/db-test.js";
import { encodeCursor } from "./domain/cursor.js";
import { buildPageQuery } from "./infra/query-repo.js";
import { transactions } from "./schema.js";

let t: OwnedTestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.drop();
});

describe("list plan", () => {
  it("the page query uses txn_family_time_idx", async () => {
    const familyId = randomUUID();
    const user = randomUUID();
    const base = new Date("2026-01-01T00:00:00.000Z").getTime();
    await t.db.insert(transactions).values(
      Array.from({ length: 300 }, (_, i) => ({
        familyId,
        type: "expense" as const,
        amountPaisa: 100,
        occurredAt: new Date(base + i * 60_000),
        createdBy: user,
        paidByUserId: user,
      })),
    );
    await t.sql`analyze ledger.transactions`;
    const cursor = { t: new Date(base + 200 * 60_000), id: randomUUID() };
    const { sql, params } = buildPageQuery(t.db, familyId, { userId: user }, { limit: 50, cursor }).toSQL();
    const plan = await t.sql.begin(async (tx) => {
      // A small table may prefer a sequential scan; the point is that the index can serve this order and filter.
      await tx.unsafe("set local enable_seqscan = off");
      await tx.unsafe("set local enable_bitmapscan = off");
      const rows = await tx.unsafe(`explain ${sql}`, params as never[]);
      return rows.map((r) => String(r["QUERY PLAN"])).join("\n");
    });
    expect(plan).toContain("txn_family_time_idx");
    expect(plan).not.toMatch(/\bSort\b/);
    expect(encodeCursor({ occurredAt: cursor.t, id: cursor.id })).toBeTruthy();
  });
});
