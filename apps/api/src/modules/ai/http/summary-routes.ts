import type { FastifyInstance } from "fastify";
import { SummaryQuerySchema, type MonthlyAiSummary } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import { currentDhakaMonth } from "../../ledger/index.js";
import type { AiDeps } from "../app/deps.js";
import { summary } from "../app/summary.js";

export function summaryRoutes(app: FastifyInstance, deps: AiDeps) {
  app.get<{ Params: { familyId: string } }>(
    "/v1/families/:familyId/ai/summary",
    { preHandler: app.authenticate, schema: docs.object },
    async (req): Promise<MonthlyAiSummary> => {
      const { familyId } = req.params;
      await deps.families.requireRole(familyId, req.user.sub, "viewer");
      const { month = currentDhakaMonth(deps.clock()), locale } = parseOr400(SummaryQuerySchema, req.query);
      return summary(deps, { familyId, userId: req.user.sub, month, locale });
    },
  );
}
