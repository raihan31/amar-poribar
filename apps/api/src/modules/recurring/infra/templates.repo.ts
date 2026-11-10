import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { Tx } from "../../../platform/events/bus.js";
import { recurringTemplates } from "../schema.js";

export type Template = typeof recurringTemplates.$inferSelect;
export type NewTemplate = typeof recurringTemplates.$inferInsert;
type Executor = Db | Tx;

export const templatesRepo = {
  listByFamily(x: Executor, familyId: string): Promise<Template[]> {
    return x.select().from(recurringTemplates).where(eq(recurringTemplates.familyId, familyId));
  },

  listActive(x: Executor): Promise<Template[]> {
    return x.select().from(recurringTemplates).where(eq(recurringTemplates.active, true));
  },

  async insert(x: Executor, values: NewTemplate): Promise<Template> {
    const [row] = await x.insert(recurringTemplates).values(values).returning();
    if (!row) throw new Error("recurring template insert returned no row");
    return row;
  },

  async update(x: Executor, familyId: string, id: string, patch: Partial<NewTemplate>): Promise<Template | null> {
    const [row] = await x
      .update(recurringTemplates)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.familyId, familyId)))
      .returning();
    return row ?? null;
  },

  /** Row lock held until the surrounding transaction ends. */
  async getForUpdate(tx: Tx, familyId: string, id: string): Promise<Template | null> {
    const [row] = await tx
      .select()
      .from(recurringTemplates)
      .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.familyId, familyId)))
      .for("update");
    return row ?? null;
  },

  /** Idempotent: a no-op when the month is already recorded. */
  async markConfirmed(x: Executor, id: string, month: string): Promise<void> {
    await x
      .update(recurringTemplates)
      .set({ lastConfirmedMonth: month })
      .where(
        and(eq(recurringTemplates.id, id), sql`${recurringTemplates.lastConfirmedMonth} is distinct from ${month}`),
      );
  },
};
