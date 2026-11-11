import { boolean, index, integer, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
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

/** One row per SMS handed to a gateway; receipts update `status` (T-ID-03). Only the phone digest is stored. */
export const smsDeliveries = identitySchema.table("sms_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneHash: text("phone_hash").notNull(),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
  status: text("status").notNull().default("sent"),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

/** Push-token registry (T-ID-09 owns it; declared here so logout can delete a device row). */
export const devices = identitySchema.table(
  "devices",
  {
    userId: uuid("user_id").notNull(),
    deviceId: text("device_id").notNull(),
    platform: text("platform").notNull(),
    fcmToken: text("fcm_token"),
    appVersion: text("app_version"),
    locale: text("locale"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.deviceId] })],
);
