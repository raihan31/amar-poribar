import { and, asc, count, eq, inArray } from "drizzle-orm";
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

/** A family as seen in the switcher (screen F2): the caller's role plus status and size. */
export interface MembershipSummary extends FamilySummary {
  status: string;
  memberLimit: number;
  memberCount: number;
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

  async countMembers(x: Executor, familyId: string): Promise<number> {
    const [row] = await x.select({ n: count() }).from(familyMembers).where(eq(familyMembers.familyId, familyId));
    return row?.n ?? 0;
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

  async listForUser(x: Executor, userId: string): Promise<MembershipSummary[]> {
    const mine = await x
      .select({
        id: families.id,
        name: families.name,
        role: familyMembers.role,
        status: families.status,
        memberLimit: families.memberLimit,
      })
      .from(familyMembers)
      .innerJoin(families, eq(families.id, familyMembers.familyId))
      .where(eq(familyMembers.userId, userId))
      .orderBy(asc(familyMembers.joinedAt), asc(families.id));
    if (mine.length === 0) return [];
    const counts = await x
      .select({ familyId: familyMembers.familyId, n: count() })
      .from(familyMembers)
      .where(
        inArray(
          familyMembers.familyId,
          mine.map((f) => f.id),
        ),
      )
      .groupBy(familyMembers.familyId);
    const byFamily = new Map(counts.map((c) => [c.familyId, c.n]));
    return mine.map((f) => ({ ...f, memberCount: byFamily.get(f.id) ?? 0 }));
  },

  async listMembersWithJoined(
    x: Executor,
    familyId: string,
  ): Promise<{ userId: string; role: Role; joinedAt: Date }[]> {
    return x
      .select({ userId: familyMembers.userId, role: familyMembers.role, joinedAt: familyMembers.joinedAt })
      .from(familyMembers)
      .where(eq(familyMembers.familyId, familyId))
      .orderBy(asc(familyMembers.joinedAt), asc(familyMembers.userId));
  },
};
