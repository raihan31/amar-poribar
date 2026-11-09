import { and, eq, inArray, lte } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MonthSchema, PutBudgetsSchema } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth.js";
import { budgetLevel, effectiveBudgets } from "../budgets.js";
import { budgets, categories } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";
import { currentDhakaMonth } from "../month.js";
import { monthTotals } from "../totals.js";

type FamilyParams = { Params: { familyId: string } };
const MonthQuery = z.object({ month: MonthSchema.optional() });

export async function budgetRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  // FR-BUD-01, FR-BUD-02, FR-BUD-03
  app.get<FamilyParams>("/v1/families/:familyId/budgets", async (req) => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "viewer");
    const { month = currentDhakaMonth() } = parseOr400(MonthQuery, req.query);

    const rows = await db
      .select({ categoryId: budgets.categoryId, month: budgets.month, limitPaisa: budgets.limitPaisa })
      .from(budgets)
      .where(and(eq(budgets.familyId, familyId), lte(budgets.month, month)));
    const effective = effectiveBudgets(rows, month);

    const totals = await monthTotals(db, familyId, req.user.sub, month);
    const spentBy = new Map(totals.byCategory.map((c) => [c.categoryId, c.totalPaisa]));
    const ids = effective.flatMap((b) => (b.categoryId ? [b.categoryId] : []));
    const cats = ids.length
      ? await db.select().from(categories).where(and(eq(categories.familyId, familyId), inArray(categories.id, ids)))
      : [];
    const catById = new Map(cats.map((c) => [c.id, c]));

    return {
      month,
      budgets: effective.map((b) => {
        const spentPaisa = b.categoryId ? (spentBy.get(b.categoryId) ?? 0) : totals.expensePaisa;
        const cat = b.categoryId ? catById.get(b.categoryId) : undefined;
        return {
          categoryId: b.categoryId,
          nameEn: b.categoryId ? (cat?.nameEn ?? "") : "Overall",
          nameBn: b.categoryId ? (cat?.nameBn ?? "") : "মোট",
          limitPaisa: b.limitPaisa,
          spentPaisa,
          level: budgetLevel(spentPaisa, b.limitPaisa),
          inherited: b.inherited,
        };
      }),
    };
  });

  app.put<FamilyParams>("/v1/families/:familyId/budgets", async (req) => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "admin");
    const { month = currentDhakaMonth() } = parseOr400(MonthQuery, req.query);
    const input = parseOr400(PutBudgetsSchema, req.body);

    const ids = [...new Set(input.budgets.flatMap((b) => (b.categoryId ? [b.categoryId] : [])))];
    if (ids.length) {
      const owned = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.familyId, familyId), inArray(categories.id, ids)));
      if (owned.length !== ids.length) throw new HttpError(400, "invalid_category", "Unknown category");
    }

    await db.transaction(async (tx) => {
      for (const b of input.budgets) {
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
    return { month, updated: input.budgets.length };
  });
}
