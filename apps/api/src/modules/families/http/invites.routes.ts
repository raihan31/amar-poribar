import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BdPhoneSchema, RoleSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { acceptInvite } from "../app/accept-invite.js";
import { createInvite } from "../app/create-invite.js";
import type { FamiliesDeps } from "../app/deps.js";

const CreateInviteSchema = z.object({
  role: RoleSchema.default("member"),
  phone: BdPhoneSchema.optional(),
});

export function invitesRoutes(app: FastifyInstance, deps: FamiliesDeps) {
  app.post<{ Params: { familyId: string } }>(
    "/v1/families/:familyId/invites",
    { preHandler: app.authenticate },
    async (req, reply) => {
      const body = parseOr400(CreateInviteSchema, req.body ?? {});
      const invite = await createInvite(deps, {
        familyId: req.params.familyId,
        actorId: req.user.sub,
        role: body.role,
        phone: body.phone,
      });
      return reply.status(201).send(invite);
    },
  );

  app.post<{ Params: { token: string } }>("/v1/invites/:token/accept", { preHandler: app.authenticate }, async (req) =>
    acceptInvite(deps, { token: req.params.token, userId: req.user.sub }),
  );
}
