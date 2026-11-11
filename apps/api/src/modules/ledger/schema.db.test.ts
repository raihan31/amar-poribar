import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type OwnedTestDb } from "../../../tests/support/db-test.js";

let t: OwnedTestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.drop();
});

const FAMILY = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

async function insertTxn(): Promise<number> {
  const [row] = await t.sql<{ sync_seq: string }[]>`
    insert into ledger.transactions (family_id, type, amount_paisa, occurred_at, created_by)
    values (${FAMILY}, 'expense', 100, now(), ${USER})
    returning sync_seq`;
  return Number(row?.sync_seq);
}

describe("ledger schema", () => {
  it("tables exist in schema ledger", async () => {
    const rows = await t.sql<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'ledger' order by tablename`;
    expect(rows.map((r) => r.tablename)).toEqual(["accounts", "categories", "transactions"]);
    const pub = await t.sql`
      select 1 from pg_tables where schemaname = 'public' and tablename in ('accounts', 'categories', 'transactions')`;
    expect(pub).toHaveLength(0);
  });

  it("sequence default produces increasing sync_seq", async () => {
    const a = await insertTxn();
    const b = await insertTxn();
    expect(b).toBeGreaterThan(a);
    const seq = await t.sql`select 1 from pg_sequences where schemaname = 'ledger' and sequencename = 'txn_sync_seq'`;
    expect(seq).toHaveLength(1);
  });

  it("no foreign key crosses schemas", async () => {
    const rows = await t.sql<{ constraint_name: string; from_schema: string; to_schema: string }[]>`
      select tc.constraint_name, tc.table_schema as from_schema, ccu.table_schema as to_schema
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
        and ccu.constraint_schema = tc.constraint_schema
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'ledger'`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.from_schema !== r.to_schema)).toEqual([]);
  });

  it("time index covers occurred_at and id descending", async () => {
    const [row] = await t.sql<{ indexdef: string }[]>`
      select indexdef from pg_indexes where schemaname = 'ledger' and indexname = 'txn_family_time_idx'`;
    expect(row?.indexdef).toMatch(
      /family_id, occurred_at DESC NULLS LAST, id DESC NULLS LAST\) WHERE \(deleted_at IS NULL\)/,
    );
  });
});
