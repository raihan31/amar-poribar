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

/** One row per refresh token. A rotation chain shares `chain_id`; only a SHA-256 of the secret is stored (T-ID-05). */
export const sessions = identitySchema.table(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    chainId: uuid("chain_id").notNull(),
    deviceId: text("device_id"),
    refreshHash: text("refresh_hash").notNull().unique(),
    parentId: uuid("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId), index("sessions_chain_id_idx").on(t.chainId)],
);
