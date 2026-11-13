import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import { loadPolicy, POLICY_UPDATED_AT, POLICY_VERSION } from "../domain/policy.js";

const PolicyQuery = z.object({ locale: z.enum(["bn", "en"]) });

/** Public: the consent screen shows the policy before login (A2). */
export function policyRoutes(app: FastifyInstance) {
  app.get("/v1/policy", { schema: docs.object }, async (req) => {
    const { locale } = parseOr400(PolicyQuery, req.query);
    return { version: POLICY_VERSION, locale, text: loadPolicy(locale), updatedAt: POLICY_UPDATED_AT };
  });
}
