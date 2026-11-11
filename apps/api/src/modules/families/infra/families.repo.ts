import { and, eq, isNull } from "drizzle-orm";
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
};
