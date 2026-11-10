import { and, eq, isNull } from "drizzle-orm";
import type { Role } from "@amar-poribar/shared";
import type { Db } from "../../../platform/db.js";
import type { Tx } from "../../../platform/events/bus.js";
import { familyInvites, familyMembers, families } from "../schema.js";

/** Either the pooled connection or an open transaction. */
export type Executor = Db | Tx;

export interface FamilySummary {
  id: string;
  name: string;
  role: Role;
}

export type FamilyRow = typeof families.$inferSelect;
export type InviteRow = typeof familyInvites.$inferSelect;

export const familiesRepo = {
  async memberRole(x: Executor, familyId: string, userId: string): Promise<Role | null> {
    const [row] = await x
      .select({ role: familyMembers.role })
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
    return row?.role ?? null;
  },

  async insertFamily(x: Executor, name: string, createdBy: string): Promise<FamilyRow> {
    const [row] = await x.insert(families).values({ name, createdBy }).returning();
    return row!;
  },

  /** Returns true when the membership was newly created. */
  async insertMember(x: Executor, familyId: string, userId: string, role: Role): Promise<boolean> {
    const rows = await x
      .insert(familyMembers)
      .values({ familyId, userId, role })
      .onConflictDoNothing()
      .returning({ userId: familyMembers.userId });
    return rows.length > 0;
  },

  async setRole(x: Executor, familyId: string, userId: string, role: Role): Promise<void> {
    await x
      .update(familyMembers)
      .set({ role })
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
  },

  async deleteMember(x: Executor, familyId: string, userId: string): Promise<void> {
    await x.delete(familyMembers).where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
  },

  async listMembers(x: Executor, familyId: string): Promise<{ userId: string; role: Role }[]> {
    return x
      .select({ userId: familyMembers.userId, role: familyMembers.role })
      .from(familyMembers)
      .where(eq(familyMembers.familyId, familyId));
  },

  async listForUser(x: Executor, userId: string): Promise<FamilySummary[]> {
    return x
      .select({ id: families.id, name: families.name, role: familyMembers.role })
      .from(familyMembers)
      .innerJoin(families, eq(families.id, familyMembers.familyId))
      .where(eq(familyMembers.userId, userId));
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
};
