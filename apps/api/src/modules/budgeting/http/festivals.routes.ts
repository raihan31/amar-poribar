import type { FastifyInstance } from "fastify";
import { CreateFestivalBudgetSchema, UpdateFestivalBudgetSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import type { BudgetingDeps } from "../app/deps.js";
import {
  createFestivalBudget,
  deleteFestivalBudget,
  listFestivalBudgets,
  updateFestivalBudget,
} from "../app/festival-usecases.js";

type FamilyParams = { Params: { familyId: string } };
type FestivalParams = { Params: { familyId: string; festivalId: string } };

export function festivalsRoutes(app: FastifyInstance, deps: BudgetingDeps) {
  const opts = { preHandler: app.authenticate };

  app.get<FamilyParams>("/v1/families/:familyId/festival-budgets", opts, async (req) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "viewer");
    return listFestivalBudgets(deps, req.params.familyId, req.user.sub);
  });

  app.post<FamilyParams>("/v1/families/:familyId/festival-budgets", opts, async (req, reply) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(CreateFestivalBudgetSchema, req.body);
    return reply.status(201).send(await createFestivalBudget(deps, req.params.familyId, body));
  });

  app.patch<FestivalParams>("/v1/families/:familyId/festival-budgets/:festivalId", opts, async (req) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(UpdateFestivalBudgetSchema, req.body);
    return updateFestivalBudget(deps, req.params.familyId, req.params.festivalId, body);
  });

  app.delete<FestivalParams>("/v1/families/:familyId/festival-budgets/:festivalId", opts, async (req, reply) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "admin");
    await deleteFestivalBudget(deps, req.params.familyId, req.params.festivalId);
    return reply.status(204).send();
  });
}
