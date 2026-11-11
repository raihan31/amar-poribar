import { and, eq } from "drizzle-orm";
import type { Role } from "@amar-poribar/shared";
import type { Db } from "../../../platform/db.js";
import type { Tx } from "../../../platform/events/bus.js";
import { familyMembers, families } from "../schema.js";

/** Either the pooled connection or an open transaction. */
export type Executor = Db | Tx;

export interface FamilySummary {
  id: string;
  name: string;
  role: Role;
}

/** The only file (with schema.ts) that reads or writes family_members. */
export const memberRepo = {
  async memberRole(x: Executor, familyId: string, userId: string): Promise<Role | null> {
    const [row] = await x
      .select({ role: familyMembers.role })
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
    return row?.role ?? null;
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

  /** Membership joined with the family row; null when the user is not a member. */
  async membership(x: Executor, familyId: string, userId: string): Promise<FamilySummary | null> {
    const [row] = await x
      .select({ id: families.id, name: families.name, role: familyMembers.role })
      .from(familyMembers)
      .innerJoin(families, eq(families.id, familyMembers.familyId))
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
    return row ?? null;
  },

  async listForUser(x: Executor, userId: string): Promise<FamilySummary[]> {
    return x
      .select({ id: families.id, name: families.name, role: familyMembers.role })
      .from(familyMembers)
      .innerJoin(families, eq(families.id, familyMembers.familyId))
      .where(eq(familyMembers.userId, userId));
  },
};
