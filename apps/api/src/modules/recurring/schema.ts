import { bigint, boolean, integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const recurringSchema = pgSchema("recurring");

/** Monthly template that produces a draft each month for the user to confirm (FR-TXN-06). */
export const recurringTemplates = recurringSchema.table("recurring_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  // families.families.id (no cross-schema foreign key, DEC-02)
  familyId: uuid("family_id").notNull(),
  name: text("name").notNull(),
  type: text("type", { enum: ["expense", "income", "transfer"] })
    .notNull()
    .default("expense"),
  amountPaisa: bigint("amount_paisa", { mode: "number" }).notNull(),
  // ledger.categories.id and ledger.accounts.id, checked through `ledger.assertRefs`
  categoryId: uuid("category_id"),
  accountId: uuid("account_id"),
  dayOfMonth: integer("day_of_month").notNull(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  remindDaysBefore: integer("remind_days_before").notNull().default(2),
  active: boolean("active").notNull().default(true),
  /** Last month (YYYY-MM) whose draft was confirmed; stops the same month being recorded twice. */
  lastConfirmedMonth: text("last_confirmed_month"),
  // identity.users.id
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
