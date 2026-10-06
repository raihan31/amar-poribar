import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MonthSchema, type MonthSummary } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth.js";
import { categories, transactions } from "../db/schema.js";
import { parseOr400 } from "../errors.js";
import { currentDhakaMonth, monthRange } from "../month.js";

type FamilyParams = { Params: { familyId: string } };

export async function reportRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  app.get<FamilyParams>("/v1/families/:familyId/reports/summary", async (req): Promise<MonthSummary> => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "viewer");
    const { month = currentDhakaMonth() } = parseOr400(z.object({ month: MonthSchema.optional() }), req.query);
    const { start, end } = monthRange(month);

    const where = and(
      eq(transactions.familyId, familyId),
      isNull(transactions.deletedAt),
      gte(transactions.occurredAt, start),
      lt(transactions.occurredAt, end),
      // Others' private entries are excluded from the breakdown (FR-TXN-05).
      or(eq(transactions.isPrivate, false), eq(transactions.createdBy, req.user.sub)),
    );

    const totals = await db
      .select({
        type: transactions.type,
        total: sql<string>`coalesce(sum(${transactions.amountPaisa} + ${transactions.feePaisa}), 0)`,
      })
      .from(transactions)
      .where(where)
      .groupBy(transactions.type);

    const byCategory = await db
      .select({
        categoryId: transactions.categoryId,
        name: sql<string>`coalesce(${categories.nameBn}, 'অন্যান্য')`,
        total: sql<string>`sum(${transactions.amountPaisa} + ${transactions.feePaisa})`,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(where, eq(transactions.type, "expense")))
      .groupBy(transactions.categoryId, categories.nameBn)
      .orderBy(sql`3 desc`);

    const totalOf = (type: string) => Number(totals.find((t) => t.type === type)?.total ?? 0);
    return {
      month,
      incomePaisa: totalOf("income"),
      expensePaisa: totalOf("expense"),
      byCategory: byCategory.map((c) => ({ categoryId: c.categoryId, name: c.name, totalPaisa: Number(c.total) })),
    };
  });
}
