import { and, asc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { familyInvites, families } from "../schema.js";

import type { Executor } from "./member-repo.js";
export type { Executor };

export type FamilyRow = typeof families.$inferSelect;
export type InviteRow = typeof familyInvites.$inferSelect;

export const familiesRepo = {
  async insertFamily(x: Executor, name: string, createdBy: string): Promise<FamilyRow> {
    const [row] = await x.insert(families).values({ name, createdBy }).returning();
    return row!;
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
};
