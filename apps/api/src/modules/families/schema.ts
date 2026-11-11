import { sql } from "drizzle-orm";
import { check, integer, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ROLES } from "@amar-poribar/shared";

export const familiesSchema = pgSchema("families");

export const roleEnum = familiesSchema.enum("role", ROLES);

export const families = familiesSchema.table(
  "families",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("BDT"),
    plan: text("plan").notNull().default("free"),
    aiQuotaMonth: integer("ai_quota_month").notNull().default(100),
    status: text("status").notNull().default("active"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    memberLimit: integer("member_limit").notNull().default(3),
    // identity.users.id (no cross-schema foreign key, DEC-02)
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("families_status_check", sql`${t.status} in ('active', 'suspended')`)],
);

export const familyMembers = familiesSchema.table(
  "family_members",
  {
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    // identity.users.id
    userId: uuid("user_id").notNull(),
    role: roleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.userId] })],
);

/** Shareable invite link, valid for 7 days (SRS FR-FAM-02). */
export const familyInvites = familiesSchema.table("family_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  role: roleEnum("role").notNull().default("member"),
  /** Optional: when set, only the user with this phone can accept. */
  phone: text("phone"),
  // identity.users.id
  createdBy: uuid("created_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  // identity.users.id
  acceptedBy: uuid("accepted_by"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
