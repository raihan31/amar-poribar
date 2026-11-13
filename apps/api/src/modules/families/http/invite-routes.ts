import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BdPhoneSchema, RoleSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import type { FamiliesDeps } from "../app/deps.js";
import { acceptInvite, createInvite, listInvites, previewInvite, revokeInvite } from "../app/invites.js";

const CreateInviteSchema = z.object({
  role: RoleSchema.default("member"),
  phone: BdPhoneSchema.optional(),
});

type FamilyParams = { Params: { familyId: string } };

export function invitesRoutes(app: FastifyInstance, deps: FamiliesDeps) {
  app.post<FamilyParams>(
    "/v1/families/:familyId/invites",
    { preHandler: app.authenticate, schema: docs.object },
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

  app.get<FamilyParams>(
    "/v1/families/:familyId/invites",
    { preHandler: app.authenticate, schema: docs.list },
    async (req) => listInvites(deps, { familyId: req.params.familyId, actorId: req.user.sub }),
  );

  app.delete<{ Params: { familyId: string; inviteId: string } }>(
    "/v1/families/:familyId/invites/:inviteId",
    { preHandler: app.authenticate, schema: docs.noContent },
    async (req, reply) => {
      await revokeInvite(deps, { ...req.params, actorId: req.user.sub });
      return reply.status(204).send();
    },
  );

  // Public: the preview is what an invited person sees before signing in (screens A6 and F6).
  app.get<{ Params: { token: string } }>(
    "/v1/invites/:token",
    {
      schema: docs.object,
      config: { rateLimit: { key: (req) => `invite-preview:ip:${req.ip}`, limit: 30, windowSeconds: 60 } },
    },
    async (req) => previewInvite(deps, req.params.token),
  );

  app.post<{ Params: { token: string } }>(
    "/v1/invites/:token/accept",
    { preHandler: app.authenticate, schema: docs.object },
    async (req) => acceptInvite(deps, { token: req.params.token, userId: req.user.sub }),
  );
}
