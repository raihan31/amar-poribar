import { bigint, boolean, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

// `budgets` and `festival_budgets` are owned by the budgeting module (T-PLAT-26).

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
