import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ACCOUNT_TYPES, ROLES } from "@amar-poribar/shared";

/**
 * Delivery order for sync. HLC decides which version of a record wins; this sequence decides what a device
 * still has to download. Devices assign their own HLCs, so an offline entry can arrive with an HLC older than
 * what the server already holds, and an HLC cursor would skip it.
 */
export const txnSyncSeq = pgSequence("txn_sync_seq");

export const roleEnum = pgEnum("role", ROLES);
export const accountTypeEnum = pgEnum("account_type", ACCOUNT_TYPES);
export const txnTypeEnum = pgEnum("txn_type", ["expense", "income", "transfer"]);
export const txnSourceEnum = pgEnum("txn_source", ["manual", "ai_text", "sms", "voice", "receipt"]);
export const categoryKindEnum = pgEnum("category_kind", ["expense", "income"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  locale: text("locale").notNull().default("bn"),
  bnDigits: boolean("bn_digits").notNull().default(true),
  ...timestamps,
});

export const families = pgTable("families", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("BDT"),
  plan: text("plan").notNull().default("free"),
  aiQuotaMonth: integer("ai_quota_month").notNull().default(100),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const familyMembers = pgTable(
  "family_members",
  {
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.userId] })],
);

/** Shareable invite link, valid for 7 days (SRS FR-FAM-02). */
export const familyInvites = pgTable("family_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  role: roleEnum("role").notNull().default("member"),
  /** Optional: when set, only the user with this phone can accept. */
  phone: text("phone"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedBy: uuid("accepted_by").references(() => users.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  openingBalancePaisa: bigint("opening_balance_paisa", { mode: "number" }).notNull().default(0),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  kind: categoryKindEnum("kind").notNull(),
  nameEn: text("name_en").notNull(),
  nameBn: text("name_bn").notNull(),
  icon: text("icon"),
  isHidden: boolean("is_hidden").notNull().default(false),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    type: txnTypeEnum("type").notNull(),
    amountPaisa: bigint("amount_paisa", { mode: "number" }).notNull(),
    feePaisa: bigint("fee_paisa", { mode: "number" }).notNull().default(0),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id),
    accountId: uuid("account_id").references(() => accounts.id),
    paidByUserId: uuid("paid_by_user_id").references(() => users.id),
    note: text("note"),
    counterparty: text("counterparty"),
    trxId: text("trx_id"),
    source: txnSourceEnum("source").notNull().default("manual"),
    aiConfidence: real("ai_confidence"),
    isPrivate: boolean("is_private").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Hybrid logical clock of the last change (SRS FR-SYNC-02). Empty for rows that predate sync. */
    hlc: text("hlc").notNull().default(""),
    /** Bumped on every insert/update (see `bumpSyncSeq`); the cursor sync clients page by. */
    syncSeq: bigint("sync_seq", { mode: "number" })
      .notNull()
      .default(sql`nextval('txn_sync_seq')`),
    ...timestamps,
  },
  (t) => [
    index("txn_family_seq_idx").on(t.familyId, t.syncSeq),
    index("txn_family_time_idx").on(t.familyId, t.occurredAt.desc()),
    // SRS FR-TXN-04: no duplicate MFS transactions.
    uniqueIndex("txn_family_trx_uidx")
      .on(t.familyId, t.trxId)
      .where(sql`${t.trxId} is not null`),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id),
    month: text("month").notNull(),
    limitPaisa: bigint("limit_paisa", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("budget_family_cat_month_uidx").on(t.familyId, t.categoryId, t.month)],
);

/** One-off budget over a date range, e.g. Eid-ul-Adha (SRS FR-BUD-04). */
export const festivalBudgets = pgTable("festival_budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on").notNull(),
  limitPaisa: bigint("limit_paisa", { mode: "number" }).notNull(),
  ...timestamps,
});

/** Monthly template that produces a draft each month for the user to confirm (FR-TXN-06). */
export const recurringTemplates = pgTable("recurring_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: txnTypeEnum("type").notNull().default("expense"),
  amountPaisa: bigint("amount_paisa", { mode: "number" }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  accountId: uuid("account_id").references(() => accounts.id),
  dayOfMonth: integer("day_of_month").notNull(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  remindDaysBefore: integer("remind_days_before").notNull().default(2),
  active: boolean("active").notNull().default(true),
  /** Last month (YYYY-MM) whose draft was confirmed; stops the same month being recorded twice. */
  lastConfirmedMonth: text("last_confirmed_month"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const aiUsage = pgTable(
  "ai_usage",
  {
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    requests: integer("requests").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.month] })],
);

/** Cached monthly summaries; regenerated only when the underlying totals change. */
export const aiSummaries = pgTable(
  "ai_summaries",
  {
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    locale: text("locale").notNull(),
    factsHash: text("facts_hash").notNull(),
    text: text("text").notNull(),
    speechText: text("speech_text").notNull(),
    usedAi: boolean("used_ai").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.month, t.locale, t.factsHash] })],
);

/** Use in every UPDATE of `transactions` so sync clients see the change. */
export const bumpSyncSeq = sql`nextval('txn_sync_seq')`;
