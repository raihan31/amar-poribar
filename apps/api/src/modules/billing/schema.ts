import { bigint, boolean, integer, pgSchema, primaryKey, text } from "drizzle-orm/pg-core";

export const billingSchema = pgSchema("billing");

/** The plan catalogue (FR-BILL-01). Editable by staff, so limits live in data, not code. Prices are integer paisa. */
export const plans = billingSchema.table("plans", {
  id: text("id").primaryKey(),
  nameBn: text("name_bn").notNull(),
  nameEn: text("name_en").notNull(),
  priceMonthPaisa: bigint("price_month_paisa", { mode: "number" }).notNull(),
  priceYearPaisa: bigint("price_year_paisa", { mode: "number" }),
  currency: text("currency").notNull().default("BDT"),
  sort: integer("sort").notNull(),
  active: boolean("active").notNull().default(true),
});

/** One row per plan and limit key. Numeric keys use `int_value` (null = unlimited), flags use `bool_value`. */
export const planLimits = billingSchema.table(
  "plan_limits",
  {
    // billing.plans.id
    planId: text("plan_id").notNull(),
    key: text("key").notNull(),
    intValue: integer("int_value"),
    boolValue: boolean("bool_value"),
  },
  (t) => [primaryKey({ columns: [t.planId, t.key] })],
);
