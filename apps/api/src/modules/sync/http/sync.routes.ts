import type { FastifyInstance } from "fastify";
import { SyncRequestSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { syncExchange, type SyncDeps } from "../app/sync-exchange.js";
import { docs } from "../../../platform/http/responses.js";

type FamilyParams = { Params: { familyId: string } };

export function syncRoutes(app: FastifyInstance, deps: SyncDeps) {
  app.post<FamilyParams>(
    "/v1/families/:familyId/sync",
    { bodyLimit: 2 * 1024 * 1024, preHandler: app.authenticate, schema: docs.object },
    async (req) => {
      const body = parseOr400(SyncRequestSchema, req.body);
      return syncExchange(deps, req.params.familyId, req.user.sub, body);
    },
  );
}
