import type { FastifyInstance } from "fastify";
import { docs } from "../../../platform/http/responses.js";
import { acceptConsent, getConsentState } from "../app/consents.js";
import type { ConsentRepo } from "../infra/consent-repo.js";

/** `POST|GET /v1/me/consents` (FR-AUTH-10). `GET /v1/policy` is served by the privacy module (T-PRIV-01). */
export function consentRoutes(app: FastifyInstance, deps: { consents: ConsentRepo; clock: () => Date }): void {
  app.post("/v1/me/consents", { preHandler: app.authenticate, schema: docs.object }, async (req, reply) => {
    const out = await acceptConsent(deps.consents, deps.clock, req.user.sub, req.body);
    return reply.code(201).send(out);
  });
  app.get("/v1/me/consents", { preHandler: app.authenticate, schema: docs.object }, async (req) =>
    getConsentState(deps.consents, req.user.sub),
  );
}
