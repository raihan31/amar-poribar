import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MonthSchema, type MonthSummary } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth.js";
import { parseOr400 } from "../errors.js";
import { currentDhakaMonth } from "../month.js";
import { monthTotals } from "../totals.js";

type FamilyParams = { Params: { familyId: string } };

export async function reportRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  app.get<FamilyParams>("/v1/families/:familyId/reports/summary", async (req): Promise<MonthSummary> => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "viewer");
    const { month = currentDhakaMonth() } = parseOr400(z.object({ month: MonthSchema.optional() }), req.query);
    const totals = await monthTotals(db, familyId, req.user.sub, month);
    return {
      month,
      incomePaisa: totals.incomePaisa,
      expensePaisa: totals.expensePaisa,
      byCategory: totals.byCategory.map(({ categoryId, name, totalPaisa }) => ({ categoryId, name, totalPaisa })),
    };
  });
}
