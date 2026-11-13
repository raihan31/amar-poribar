import type { FastifyInstance } from "fastify";
import { HttpError } from "../platform/errors.js";
import type { ModuleContext } from "../platform/module.js";
import { docs } from "../platform/http/responses.js";

/**
 * `GET /v1/me`: the profile from `identity`, the memberships from `families` and the policy state from
 * `privacy` + `identity` (SRS §5, composition layer). The family switcher (F2) and the consent gate read this.
 */
export function meRoutes(app: FastifyInstance, ctx: ModuleContext) {
  app.get("/v1/me", { preHandler: app.authenticate, schema: docs.object }, async (req) => {
    const { identity, families, privacy } = ctx.facades;
    if (!identity || !families || !privacy) {
      throw new Error("composition: identity, families and privacy must be registered");
    }
    const user = await identity.getUserBasics(req.user.sub);
    if (!user) throw new HttpError(404, "not_found", "User not found");
    const policyVersion = privacy.getCurrentPolicyVersion();
    const [memberships, accepted] = await Promise.all([
      families.listMemberships(user.id),
      identity.hasAcceptedCurrentPolicy(user.id, policyVersion),
    ]);
    return {
      user,
      families: memberships.map((f) => ({
        id: f.id,
        name: f.name,
        role: f.role,
        status: f.status,
        memberLimit: f.memberLimit,
        memberCount: f.memberCount,
      })),
      consents: { policyVersion, needsAcceptance: !accepted },
    };
  });
}
