import { bigint, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const budgetingSchema = pgSchema("budgeting");

export const budgets = budgetingSchema.table(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // families.families.id (no cross-schema foreign key, DEC-02)
    familyId: uuid("family_id").notNull(),
    // ledger.categories.id
    categoryId: uuid("category_id"),
    month: text("month").notNull(),
    limitPaisa: bigint("limit_paisa", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("budget_family_cat_month_uidx").on(t.familyId, t.categoryId, t.month)],
);

/** One-off budget over a date range, e.g. Eid-ul-Adha (SRS FR-BUD-04). */
export const festivalBudgets = budgetingSchema.table("festival_budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  // families.families.id
  familyId: uuid("family_id").notNull(),
  name: text("name").notNull(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on").notNull(),
  limitPaisa: bigint("limit_paisa", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
