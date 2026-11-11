import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MonthSchema, PutBudgetsSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { currentDhakaMonth } from "../../../platform/time/month.js";
import type { BudgetingDeps } from "../app/deps.js";
import { getBudgetStatus } from "../app/get-budgets.js";
import { putBudgets } from "../app/put-budgets.js";
import { docs } from "../../../platform/http/responses.js";

type FamilyParams = { Params: { familyId: string } };
const MonthQuery = z.object({ month: MonthSchema.optional() });

export function budgetsRoutes(app: FastifyInstance, deps: BudgetingDeps) {
  const opts = { preHandler: app.authenticate };

  app.get<FamilyParams>("/v1/families/:familyId/budgets", { ...opts, schema: docs.object }, async (req) => {
    const { familyId } = req.params;
    await deps.families.requireRole(familyId, req.user.sub, "viewer");
    const { month = currentDhakaMonth() } = parseOr400(MonthQuery, req.query);
    return getBudgetStatus(deps, familyId, { userId: req.user.sub }, month);
  });

  app.put<FamilyParams>("/v1/families/:familyId/budgets", { ...opts, schema: docs.object }, async (req) => {
    const { familyId } = req.params;
    await deps.families.requireRole(familyId, req.user.sub, "admin");
    const { month = currentDhakaMonth() } = parseOr400(MonthQuery, req.query);
    const input = parseOr400(PutBudgetsSchema, req.body);
    return putBudgets(deps, familyId, month, input);
  });
}
