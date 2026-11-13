import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import type { FamiliesDeps } from "../app/deps.js";
import { transferOwnership } from "../app/transfer-ownership.js";

const TransferSchema = z.object({ toUserId: z.uuid() });

export function transferRoutes(app: FastifyInstance, deps: FamiliesDeps) {
  app.post<{ Params: { familyId: string } }>(
    "/v1/families/:familyId/transfer-ownership",
    { preHandler: app.authenticate, schema: docs.object },
    async (req) => {
      const { toUserId } = parseOr400(TransferSchema, req.body);
      return transferOwnership(deps, {
        familyId: req.params.familyId,
        toUserId,
        actor: { kind: "user", id: req.user.sub },
      });
    },
  );
}
