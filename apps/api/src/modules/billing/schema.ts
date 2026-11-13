import { bigint, boolean, integer, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

/** Staff-set quota overrides per family (T-ADM-08 writes them). Null columns mean "use the plan value". */
export const familyOverrides = billingSchema.table("family_overrides", {
  familyId: uuid("family_id").primaryKey(),
  aiEntriesMonth: integer("ai_entries_month"),
  membersMax: integer("members_max"),
  reason: text("reason").notNull(),
  setBy: uuid("set_by").notNull(),
  setAt: timestamp("set_at", { withTimezone: true }).notNull().defaultNow(),
});
