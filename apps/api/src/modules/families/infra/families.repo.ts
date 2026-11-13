import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, lt, notExists, or, sql, type SQL } from "drizzle-orm";
import { familyInvites, familyMembers, families } from "../schema.js";

import type { Executor } from "./member-repo.js";
export type { Executor };

export type FamilyRow = typeof families.$inferSelect;
export type InviteRow = typeof familyInvites.$inferSelect;

export const familiesRepo = {
  /** Row lock on the family; serialises concurrent role changes. Returns false when the family does not exist. */
  async lock(x: Executor, familyId: string): Promise<boolean> {
    const rows = await x.select({ id: families.id }).from(families).where(eq(families.id, familyId)).for("update");
    return rows.length > 0;
  },

  async insertFamily(x: Executor, name: string, createdBy: string): Promise<FamilyRow> {
    const [row] = await x.insert(families).values({ name, createdBy }).returning();
    return row!;
  },

  async status(x: Executor, familyId: string): Promise<string | null> {
    const [row] = await x.select({ status: families.status }).from(families).where(eq(families.id, familyId));
    return row?.status ?? null;
  },

  /** Sets the suspension columns; returns the previous status, or null when the family does not exist. */
  async setSuspension(
    x: Executor,
    familyId: string,
    v: { status: "active" | "suspended"; suspendedAt: Date | null; suspendedReason: string | null },
  ): Promise<string | null> {
    const [before] = await x.select({ status: families.status }).from(families).where(eq(families.id, familyId));
    if (!before) return null;
    await x.update(families).set(v).where(eq(families.id, familyId));
    return before.status;
  },

  async aiQuota(x: Executor, familyId: string): Promise<{ quotaMonth: number; plan: string } | null> {
    const [row] = await x
      .select({ quotaMonth: families.aiQuotaMonth, plan: families.plan })
      .from(families)
      .where(eq(families.id, familyId));
    return row ?? null;
  },

  async insertInvite(x: Executor, v: typeof familyInvites.$inferInsert): Promise<InviteRow> {
    const [row] = await x.insert(familyInvites).values(v).returning();
    return row!;
  },

  async inviteByToken(x: Executor, token: string): Promise<InviteRow | null> {
    const [row] = await x.select().from(familyInvites).where(eq(familyInvites.token, token));
    return row ?? null;
  },

  /** Marks the invite used; returns false when someone else got there first. */
  async markInviteAccepted(x: Executor, id: string, userId: string, at: Date): Promise<boolean> {
    const rows = await x
      .update(familyInvites)
      .set({ acceptedBy: userId, acceptedAt: at })
      .where(and(eq(familyInvites.id, id), isNull(familyInvites.acceptedAt)))
      .returning({ id: familyInvites.id });
    return rows.length > 0;
  },

  /** Claims the one-time delivery of an invite; false when it was already delivered or does not exist. */
  async claimInviteDelivery(x: Executor, id: string, at: Date): Promise<boolean> {
    const rows = await x
      .update(familyInvites)
      .set({ deliveredAt: at })
      .where(and(eq(familyInvites.id, id), isNull(familyInvites.deliveredAt)))
      .returning({ id: familyInvites.id });
    return rows.length > 0;
  },

  async releaseInviteDelivery(x: Executor, id: string): Promise<void> {
    await x.update(familyInvites).set({ deliveredAt: null }).where(eq(familyInvites.id, id));
  },

  async familyById(x: Executor, id: string): Promise<FamilyRow | null> {
    const [row] = await x.select().from(families).where(eq(families.id, id));
    return row ?? null;
  },

  async rename(x: Executor, id: string, name: string, at: Date): Promise<FamilyRow | null> {
    const [row] = await x.update(families).set({ name, updatedAt: at }).where(eq(families.id, id)).returning();
    return row ?? null;
  },

  /** Not accepted, not revoked and not expired. */
  async listPendingInvites(x: Executor, familyId: string, now: Date): Promise<InviteRow[]> {
    return x
      .select()
      .from(familyInvites)
      .where(
        and(
          eq(familyInvites.familyId, familyId),
          isNull(familyInvites.acceptedAt),
          isNull(familyInvites.revokedAt),
          gt(familyInvites.expiresAt, now),
        ),
      )
      .orderBy(asc(familyInvites.createdAt), asc(familyInvites.id));
  },

  /** Revokes a still-pending invite of the family; returns false when there is none. */
  async revokeInvite(x: Executor, familyId: string, inviteId: string, at: Date): Promise<boolean> {
    const rows = await x
      .update(familyInvites)
      .set({ revokedAt: at })
      .where(
        and(
          eq(familyInvites.id, inviteId),
          eq(familyInvites.familyId, familyId),
          isNull(familyInvites.acceptedAt),
          isNull(familyInvites.revokedAt),
        ),
      )
      .returning({ id: familyInvites.id });
    return rows.length > 0;
  },

  /** Deletes unused invites that expired, or were revoked, before `cutoff`. Used invites stay as history. */
  async purgeInvites(x: Executor, cutoff: Date): Promise<number> {
    const rows = await x
      .delete(familyInvites)
      .where(
        and(
          isNull(familyInvites.acceptedAt),
          or(lt(familyInvites.expiresAt, cutoff), lt(familyInvites.revokedAt, cutoff)),
        ),
      )
      .returning({ id: familyInvites.id });
    return rows.length;
  },

  /** Copies the plan limits that billing announced. Returns false when the family does not exist. */
  async applyPlan(
    x: Executor,
    familyId: string,
    v: { plan: string; memberLimit: number; aiQuotaMonth: number },
    at: Date,
  ): Promise<boolean> {
    const rows = await x
      .update(families)
      .set({ plan: v.plan, memberLimit: v.memberLimit, aiQuotaMonth: v.aiQuotaMonth, updatedAt: at })
      .where(eq(families.id, familyId))
      .returning({ id: families.id });
    return rows.length > 0;
  },

  /** Newest first, keyset-paged on (created_at truncated to ms, id). Fetches `limit` rows. */
  async listForStaff(
    x: Executor,
    f: {
      query?: string | undefined;
      status?: string | undefined;
      plan?: string | undefined;
      cursor?: { createdAt: Date; id: string } | undefined;
      limit: number;
    },
  ) {
    const created = sql`date_trunc('milliseconds', ${families.createdAt})`;
    const conds: SQL[] = [];
    if (f.query) conds.push(ilike(families.name, `%${f.query.replace(/[\\%_]/g, "\\$&")}%`));
    if (f.status) conds.push(eq(families.status, f.status));
    if (f.plan) conds.push(eq(families.plan, f.plan));
    if (f.cursor)
      conds.push(
        sql`(${created}, ${families.id}) < (${f.cursor.createdAt.toISOString()}::timestamptz, ${f.cursor.id}::uuid)`,
      );
    return x
      .select({
        id: families.id,
        name: families.name,
        plan: families.plan,
        status: families.status,
        createdAt: families.createdAt,
      })
      .from(families)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(created), desc(families.id))
      .limit(f.limit);
  },

  async countFamilies(x: Executor): Promise<number> {
    const [row] = await x.select({ n: count() }).from(families);
    return row?.n ?? 0;
  },

  /** Families that have no member with the owner role. */
  async withoutOwner(x: Executor) {
    return x
      .select({
        id: families.id,
        name: families.name,
        plan: families.plan,
        status: families.status,
        createdAt: families.createdAt,
      })
      .from(families)
      .where(
        notExists(
          x
            .select({ one: sql`1` })
            .from(familyMembers)
            .where(and(eq(familyMembers.familyId, families.id), eq(familyMembers.role, "owner"))),
        ),
      )
      .orderBy(asc(families.createdAt), asc(families.id));
  },

  async memberCounts(x: Executor, familyIds: string[]): Promise<Map<string, number>> {
    if (familyIds.length === 0) return new Map();
    const rows = await x
      .select({ familyId: familyMembers.familyId, n: count() })
      .from(familyMembers)
      .where(inArray(familyMembers.familyId, familyIds))
      .groupBy(familyMembers.familyId);
    return new Map(rows.map((r) => [r.familyId, r.n]));
  },

  async ownerIds(x: Executor, familyIds: string[]): Promise<Map<string, string>> {
    if (familyIds.length === 0) return new Map();
    const rows = await x
      .select({ familyId: familyMembers.familyId, userId: familyMembers.userId })
      .from(familyMembers)
      .where(and(inArray(familyMembers.familyId, familyIds), eq(familyMembers.role, "owner")))
      .orderBy(asc(familyMembers.joinedAt), asc(familyMembers.userId));
    const out = new Map<string, string>();
    for (const r of rows) if (!out.has(r.familyId)) out.set(r.familyId, r.userId);
    return out;
  },
};
