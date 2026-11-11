import type { FastifyInstance } from "fastify";
import { UpdateProfileSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import type { UserRepo } from "../app/ports.js";
import { updateProfile } from "../app/update-profile.js";

/** `PATCH /v1/me`. `GET /v1/me` lives in the composition layer (it joins families). */
export function meRoutes(app: FastifyInstance, deps: { users: UserRepo }): void {
  app.patch("/v1/me", { preHandler: app.authenticate, schema: docs.object }, async (req) =>
    updateProfile(deps.users, req.user.sub, parseOr400(UpdateProfileSchema, req.body)),
  );
}
