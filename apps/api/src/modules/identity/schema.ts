import { boolean, index, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
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

/** One row per issued sign-in code. Only HMAC digests are stored, never the phone or the code (T-ID-02). */
export const otpChallenges = identitySchema.table(
  "otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phoneHash: text("phone_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [index("otp_challenges_phone_created_idx").on(t.phoneHash, t.createdAt.desc())],
);
