import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RoleSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import type { FamiliesDeps } from "../app/deps.js";
import { listMembers } from "../app/list-members.js";
import { changeMemberRole, removeMember } from "../app/manage-member.js";
import { docs } from "../../../platform/http/responses.js";

const UpdateMemberSchema = z.object({ role: RoleSchema });

type FamilyParams = { Params: { familyId: string } };
type MemberParams = { Params: { familyId: string; userId: string } };

export function membersRoutes(app: FastifyInstance, deps: FamiliesDeps) {
  const opts = { preHandler: app.authenticate };

  app.get<FamilyParams>("/v1/families/:familyId/members", { ...opts, schema: docs.list }, async (req) =>
    listMembers(deps, { familyId: req.params.familyId, actorId: req.user.sub }),
  );

  app.patch<MemberParams>("/v1/families/:familyId/members/:userId", { ...opts, schema: docs.object }, async (req) => {
    const { role } = parseOr400(UpdateMemberSchema, req.body);
    return changeMemberRole(deps, { ...req.params, actorId: req.user.sub, role });
  });

  app.delete<MemberParams>(
    "/v1/families/:familyId/members/:userId",
    { ...opts, schema: docs.noContent },
    async (req, reply) => {
      await removeMember(deps, { ...req.params, actorId: req.user.sub });
      return reply.status(204).send();
    },
  );
}
