import { and, eq, lte, sql } from "drizzle-orm";
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

  /**
   * Upsert limits for one month in one transaction. The unique index is an expression index
   * (NULL category = one overall key), so the conflict target repeats the expression.
   */
  upsertMonth(db: Db, familyId: string, month: string, items: { categoryId: string | null; limitPaisa: number }[]) {
    return db.transaction(async (tx) => {
      for (const b of items) {
        await tx.execute(sql`
          insert into budgeting.budgets (family_id, category_id, month, limit_paisa)
          values (${familyId}, ${b.categoryId}, ${month}, ${b.limitPaisa})
          on conflict (family_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), month)
          do update set limit_paisa = excluded.limit_paisa`);
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
