import type { FastifyInstance } from "fastify";
import { CreateCategorySchema, UpdateCategorySchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { createCategory, listCategories, updateCategory } from "../app/categories.js";
import type { LedgerDeps } from "../app/deps.js";

type FamilyParams = { Params: { familyId: string } };
type CategoryParams = { Params: { familyId: string; categoryId: string } };

export function categoriesRoutes(app: FastifyInstance, deps: LedgerDeps) {
  const opts = { preHandler: app.authenticate };

  app.get<FamilyParams>("/v1/families/:familyId/categories", opts, async (req) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "viewer");
    return listCategories(deps, req.params.familyId);
  });

  app.post<FamilyParams>("/v1/families/:familyId/categories", opts, async (req, reply) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(CreateCategorySchema, req.body);
    return reply.status(201).send(await createCategory(deps, req.params.familyId, body));
  });

  app.patch<CategoryParams>("/v1/families/:familyId/categories/:categoryId", opts, async (req) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(UpdateCategorySchema, req.body);
    return updateCategory(deps, req.params.familyId, req.params.categoryId, body);
  });
}
