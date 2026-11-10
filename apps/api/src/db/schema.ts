import { bigint, boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// `accounts`, `categories` and `transactions` (and their enums and the sync sequence) are owned by the ledger
// module (T-PLAT-25). They are re-exported so the legacy tables below and the unmoved routes keep working.
export {
  accounts,
  accountTypeEnum,
  bumpSyncSeq,
  categories,
  categoryKindEnum,
  transactions,
  txnSourceEnum,
  txnSyncSeq,
  txnTypeEnum,
} from "../modules/ledger/schema.js";
import { accounts, categories, txnTypeEnum } from "../modules/ledger/schema.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// `users` is owned by the identity module (T-PLAT-23); re-exported so the legacy tables below keep their foreign keys.
export { users } from "../modules/identity/schema.js";
import { users } from "../modules/identity/schema.js";

// `families`, `family_members` and `family_invites` are owned by the families module (T-PLAT-24). Only the
// `families` table is re-exported, so the legacy tables below keep their foreign keys and the AI quota lookup.
export { families } from "../modules/families/schema.js";
import { families } from "../modules/families/schema.js";

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
