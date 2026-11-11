import type { FastifyInstance } from "fastify";
import { ParseRequestSchema, type ParseResponse } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import type { AiDeps } from "../app/deps.js";
import { parse } from "../app/parse.js";

export function parseRoutes(app: FastifyInstance, deps: AiDeps) {
  app.post<{ Params: { familyId: string } }>(
    "/v1/families/:familyId/ai/parse",
    { preHandler: app.authenticate, schema: docs.object },
    async (req): Promise<ParseResponse> => {
      const { familyId } = req.params;
      await deps.families.requireRole(familyId, req.user.sub, "member");
      const { text, now } = parseOr400(ParseRequestSchema, req.body);
      return parse(deps, familyId, text, now);
    },
  );
}
