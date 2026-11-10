import { boolean, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgSchema } from "drizzle-orm/pg-core";

export const identitySchema = pgSchema("identity");

export const users = identitySchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  locale: text("locale").notNull().default("bn"),
  bnDigits: boolean("bn_digits").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  simpleMode: boolean("simple_mode").notNull().default(false),
  erasureRequestedAt: timestamp("erasure_requested_at", { withTimezone: true }),
  erasedAt: timestamp("erased_at", { withTimezone: true }),
});
