import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ACCOUNT_TYPES, ROLES } from "@amar-poribar/shared";

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
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps,
});

export const familyMembers = pgTable(
  "family_members",
  {
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.userId] })],
);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  openingBalancePaisa: bigint("opening_balance_paisa", { mode: "number" }).notNull().default(0),
  ...timestamps,
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
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
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
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
    createdBy: uuid("created_by").notNull().references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("txn_family_time_idx").on(t.familyId, t.occurredAt.desc()),
    // SRS FR-TXN-04: no duplicate MFS transactions.
    uniqueIndex("txn_family_trx_uidx").on(t.familyId, t.trxId).where(sql`${t.trxId} is not null`),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id),
    month: text("month").notNull(),
    limitPaisa: bigint("limit_paisa", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("budget_family_cat_month_uidx").on(t.familyId, t.categoryId, t.month)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    requests: integer("requests").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.month] })],
);
