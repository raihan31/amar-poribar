import type { FastifyInstance } from "fastify";
import {
  AskRequestSchema,
  ParseRequestSchema,
  ReceiptRequestSchema,
  SummaryQuerySchema,
  type MonthlyAiSummary,
  type ParseResponse,
} from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { currentDhakaMonth } from "../../ledger/index.js";
import { ask } from "../app/ask.js";
import type { AiDeps } from "../app/deps.js";
import { parse } from "../app/parse.js";
import { receipt } from "../app/receipt.js";
import { summary } from "../app/summary.js";

type FamilyParams = { Params: { familyId: string } };

export function aiRoutes(app: FastifyInstance, deps: AiDeps) {
  const auth = { preHandler: app.authenticate };

  app.post<FamilyParams>("/v1/families/:familyId/ai/parse", auth, async (req): Promise<ParseResponse> => {
    const { familyId } = req.params;
    await deps.families.requireRole(familyId, req.user.sub, "member");
    const { text, now } = parseOr400(ParseRequestSchema, req.body);
    return parse(deps, familyId, text, now);
  });

  app.get<FamilyParams>("/v1/families/:familyId/ai/summary", auth, async (req): Promise<MonthlyAiSummary> => {
    const { familyId } = req.params;
    await deps.families.requireRole(familyId, req.user.sub, "viewer");
    const { month = currentDhakaMonth(deps.clock()), locale } = parseOr400(SummaryQuerySchema, req.query);
    return summary(deps, { familyId, userId: req.user.sub, month, locale });
  });

  app.post<FamilyParams>("/v1/families/:familyId/ai/ask", auth, async (req) => {
    const { familyId } = req.params;
    // Members and above: viewers are summary-only (FR-FAM-05), and Ask can read individual entries.
    await deps.families.requireRole(familyId, req.user.sub, "member");
    const { question, forSpeech } = parseOr400(AskRequestSchema, req.body);
    return ask(deps, { familyId, userId: req.user.sub, question, forSpeech });
  });

  app.post<FamilyParams>(
    "/v1/families/:familyId/ai/receipt",
    // Base64 inflates ~33%, so a 5 MB photo needs a larger body limit than Fastify's 1 MB default.
    { ...auth, bodyLimit: 8 * 1024 * 1024 },
    async (req): Promise<ParseResponse> => {
      const { familyId } = req.params;
      await deps.families.requireRole(familyId, req.user.sub, "member");
      return receipt(deps, familyId, parseOr400(ReceiptRequestSchema, req.body));
    },
  );
}
