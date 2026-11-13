import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, pgSchema, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ACCOUNT_TYPES } from "@amar-poribar/shared";

export const ledgerSchema = pgSchema("ledger");

/**
 * Delivery order for sync. HLC decides which version of a record wins; this sequence decides what a device
 * still has to download. Devices assign their own HLCs, so an offline entry can arrive with an HLC older than
 * what the server already holds, and an HLC cursor would skip it.
 */
export const txnSyncSeq = ledgerSchema.sequence("txn_sync_seq");

export const accountTypeEnum = ledgerSchema.enum("account_type", ACCOUNT_TYPES);
export const txnTypeEnum = ledgerSchema.enum("txn_type", ["expense", "income", "transfer"]);
export const txnSourceEnum = ledgerSchema.enum("txn_source", ["manual", "ai_text", "sms", "voice", "receipt"]);
export const categoryKindEnum = ledgerSchema.enum("category_kind", ["expense", "income"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const accounts = ledgerSchema.table("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  // families.families.id (no cross-schema foreign key, DEC-02)
  familyId: uuid("family_id").notNull(),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  // identity.users.id
  ownerUserId: uuid("owner_user_id"),
  openingBalancePaisa: bigint("opening_balance_paisa", { mode: "number" }).notNull().default(0),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

export const categories = ledgerSchema.table(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // families.families.id
    familyId: uuid("family_id").notNull(),
    key: text("key").notNull(),
    kind: categoryKindEnum("kind").notNull(),
    nameEn: text("name_en").notNull(),
    nameBn: text("name_bn").notNull(),
    icon: text("icon"),
    isHidden: boolean("is_hidden").notNull().default(false),
  },
  (t) => [uniqueIndex("categories_family_key_uidx").on(t.familyId, t.key)],
);

export const transactions = ledgerSchema.table(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // families.families.id
    familyId: uuid("family_id").notNull(),
    type: txnTypeEnum("type").notNull(),
    amountPaisa: bigint("amount_paisa", { mode: "number" }).notNull(),
    feePaisa: bigint("fee_paisa", { mode: "number" }).notNull().default(0),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id),
    accountId: uuid("account_id").references(() => accounts.id),
    /** Destination of a transfer; null for every other type (T-LED-08). */
    toAccountId: uuid("to_account_id").references(() => accounts.id),
    // identity.users.id
    paidByUserId: uuid("paid_by_user_id"),
    note: text("note"),
    counterparty: text("counterparty"),
    trxId: text("trx_id"),
    source: txnSourceEnum("source").notNull().default("manual"),
    aiConfidence: real("ai_confidence"),
    isPrivate: boolean("is_private").notNull().default(false),
    // identity.users.id
    createdBy: uuid("created_by").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Hybrid logical clock of the last change (SRS FR-SYNC-02). Empty for rows that predate sync. */
    hlc: text("hlc").notNull().default(""),
    /** Bumped on every insert/update (see `bumpSyncSeq`); the cursor sync clients page by. */
    syncSeq: bigint("sync_seq", { mode: "number" })
      .notNull()
      .default(sql`nextval('ledger.txn_sync_seq')`),
    ...timestamps,
  },
  (t) => [
    check("transfer_needs_destination", sql`(${t.type} = 'transfer') = (${t.toAccountId} is not null)`),
    index("txn_family_seq_idx").on(t.familyId, t.syncSeq),
    index("txn_family_time_idx")
      .on(t.familyId, t.occurredAt.desc(), t.id.desc())
      .where(sql`${t.deletedAt} is null`),
    // SRS FR-TXN-04: no duplicate MFS transactions.
    uniqueIndex("txn_family_trx_uidx")
      .on(t.familyId, t.trxId)
      .where(sql`${t.trxId} is not null`),
  ],
);

/** Use in every UPDATE of `transactions` so sync clients see the change. */
export const bumpSyncSeq = sql`nextval('ledger.txn_sync_seq')`;
