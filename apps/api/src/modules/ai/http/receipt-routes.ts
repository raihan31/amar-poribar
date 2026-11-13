import type { FastifyInstance } from "fastify";
import { ReceiptRequestSchema, type ParseResponse } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import type { AiDeps } from "../app/deps.js";
import { receipt } from "../app/receipt.js";

export function receiptRoutes(app: FastifyInstance, deps: AiDeps) {
  app.post<{ Params: { familyId: string } }>(
    "/v1/families/:familyId/ai/receipt",
    // Base64 inflates ~33%, so a 5 MB photo needs a larger body limit than Fastify's 1 MB default.
    { preHandler: app.authenticate, bodyLimit: 8 * 1024 * 1024, schema: docs.object },
    async (req): Promise<ParseResponse> => {
      const { familyId } = req.params;
      await deps.families.requireRole(familyId, req.user.sub, "member");
      return receipt(deps, familyId, parseOr400(ReceiptRequestSchema, req.body));
    },
  );
}
