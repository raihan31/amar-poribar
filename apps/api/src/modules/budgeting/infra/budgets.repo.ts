import { and, eq, lte } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import { budgets, festivalBudgets } from "../schema.js";

export type FestivalBudget = typeof festivalBudgets.$inferSelect;
export type NewFestivalBudget = typeof festivalBudgets.$inferInsert;

export const budgetsRepo = {
  /** Every budget row set for `month` or earlier (the caller picks the effective ones). */
  listUpTo(db: Db, familyId: string, month: string) {
    return db
      .select({ categoryId: budgets.categoryId, month: budgets.month, limitPaisa: budgets.limitPaisa })
      .from(budgets)
      .where(and(eq(budgets.familyId, familyId), lte(budgets.month, month)));
  },

  /** Upsert limits for one month in one transaction. */
  upsertMonth(db: Db, familyId: string, month: string, items: { categoryId: string | null; limitPaisa: number }[]) {
    return db.transaction(async (tx) => {
      for (const b of items) {
        const where = and(
          eq(budgets.familyId, familyId),
          eq(budgets.month, month),
          b.categoryId ? eq(budgets.categoryId, b.categoryId) : undefined,
        );
        // The unique index treats NULL category ids as distinct, so overall rows are matched by hand.
        const existing = (await tx.select().from(budgets).where(where)).find(
          (r) => (r.categoryId ?? null) === b.categoryId,
        );
        if (existing) {
          await tx.update(budgets).set({ limitPaisa: b.limitPaisa }).where(eq(budgets.id, existing.id));
        } else {
          await tx.insert(budgets).values({ familyId, month, categoryId: b.categoryId, limitPaisa: b.limitPaisa });
        }
      }
    });
  },

  listFestivals(db: Db, familyId: string): Promise<FestivalBudget[]> {
    return db.select().from(festivalBudgets).where(eq(festivalBudgets.familyId, familyId));
  },

  async getFestival(db: Db, familyId: string, id: string): Promise<FestivalBudget | null> {
    const [row] = await db
      .select()
      .from(festivalBudgets)
      .where(and(eq(festivalBudgets.id, id), eq(festivalBudgets.familyId, familyId)));
    return row ?? null;
  },

  async insertFestival(db: Db, values: NewFestivalBudget): Promise<FestivalBudget> {
    const [row] = await db.insert(festivalBudgets).values(values).returning();
    return row!;
  },

  async updateFestival(
    db: Db,
    familyId: string,
    id: string,
    set: Partial<NewFestivalBudget>,
  ): Promise<FestivalBudget | null> {
    const [row] = await db
      .update(festivalBudgets)
      .set({ ...set, updatedAt: new Date() })
      .where(and(eq(festivalBudgets.id, id), eq(festivalBudgets.familyId, familyId)))
      .returning();
    return row ?? null;
  },

  async deleteFestival(db: Db, familyId: string, id: string): Promise<boolean> {
    const deleted = await db
      .delete(festivalBudgets)
      .where(and(eq(festivalBudgets.id, id), eq(festivalBudgets.familyId, familyId)))
      .returning({ id: festivalBudgets.id });
    return deleted.length > 0;
  },
};
