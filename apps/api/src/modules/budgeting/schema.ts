import { sql } from "drizzle-orm";
import { bigint, check, pgSchema, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const budgetingSchema = pgSchema("budgeting");

export const budgets = budgetingSchema.table(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // families.families.id (no cross-schema foreign key, DEC-02)
    familyId: uuid("family_id").notNull(),
    // ledger.categories.id (no foreign key; validated with ledger.assertRefs on write)
    categoryId: uuid("category_id"),
    month: text("month").notNull(),
    limitPaisa: bigint("limit_paisa", { mode: "number" }).notNull(),
  },
  (t) => [
    // NULL category ids (the overall budget) count as one key, so there is exactly one overall row per month.
    uniqueIndex("budget_family_cat_month_uidx").on(
      t.familyId,
      sql`coalesce(${t.categoryId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      t.month,
    ),
  ],
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

/** One row per threshold crossed per budget per month; the unique key is what makes alerts fire once (FR-BUD-05). */
export const budgetAlerts = budgetingSchema.table(
  "budget_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // families.families.id
    familyId: uuid("family_id").notNull(),
    // 'overall' or the category uuid
    budgetKey: text("budget_key").notNull(),
    month: text("month").notNull(),
    threshold: smallint("threshold").notNull(),
    spentPaisa: bigint("spent_paisa", { mode: "number" }).notNull(),
    limitPaisa: bigint("limit_paisa", { mode: "number" }).notNull(),
    firedAt: timestamp("fired_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("budget_alerts_uidx").on(t.familyId, t.budgetKey, t.month, t.threshold),
    check("budget_alerts_threshold_chk", sql`${t.threshold} in (80, 100)`),
  ],
);
