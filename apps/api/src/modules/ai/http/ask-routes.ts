import type { FastifyInstance } from "fastify";
import { AskRequestSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import { ask } from "../app/ask.js";
import type { AiDeps } from "../app/deps.js";

export function askRoutes(app: FastifyInstance, deps: AiDeps) {
  app.post<{ Params: { familyId: string } }>(
    "/v1/families/:familyId/ai/ask",
    { preHandler: app.authenticate, schema: docs.object },
    async (req) => {
      const { familyId } = req.params;
      // Members and above: viewers are summary-only (FR-FAM-05), and Ask can read individual entries.
      await deps.families.requireRole(familyId, req.user.sub, "member");
      const { question, forSpeech } = parseOr400(AskRequestSchema, req.body);
      return ask(deps, { familyId, userId: req.user.sub, question, forSpeech });
    },
  );
}
