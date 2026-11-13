import type { FastifyInstance } from "fastify";
import { HttpError } from "../platform/errors.js";
import type { ModuleContext } from "../platform/module.js";
import { docs } from "../platform/http/responses.js";

/** `GET /v1/me`: the profile from `identity` plus the memberships from `families` (SRS §5, composition layer). */
export function meRoutes(app: FastifyInstance, ctx: ModuleContext) {
  app.get("/v1/me", { preHandler: app.authenticate, schema: docs.object }, async (req) => {
    const { identity, families } = ctx.facades;
    if (!identity || !families) throw new Error("composition: identity and families must be registered");
    const user = await identity.getUserBasics(req.user.sub);
    if (!user) throw new HttpError(404, "not_found", "User not found");
    const memberships = await families.listFamiliesForUser(user.id);
    // Same body as before the module split: the user row plus the memberships (test vector api/me.json).
    return { user, families: memberships };
  });
}
