import type { FastifyInstance } from "fastify";
import { docs } from "../../../platform/http/responses.js";
import type { EntitlementsService } from "../app/entitlements.js";

type Requirer = (familyId: string, userId: string, minRole: "viewer") => Promise<unknown>;

/** `GET /v1/families/:familyId/entitlements`: effective limits for any member (FR-BILL-05). */
export function entitlementsRoutes(
  app: FastifyInstance,
  deps: { service: EntitlementsService; requireRole: Requirer },
): void {
  app.get<{ Params: { familyId: string } }>(
    "/v1/families/:familyId/entitlements",
    { preHandler: app.authenticate, schema: docs.object },
    async (req) => {
      await deps.requireRole(req.params.familyId, req.user.sub, "viewer");
      return deps.service.entitlements(req.params.familyId);
    },
  );
}
