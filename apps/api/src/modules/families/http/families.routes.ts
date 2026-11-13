import type { FastifyInstance } from "fastify";
import { CreateFamilySchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { createFamily } from "../app/create-family.js";
import type { FamiliesDeps } from "../app/deps.js";
import { getFamily, updateFamily } from "../app/update-family.js";
import { docs } from "../../../platform/http/responses.js";

/** Only the name is editable through this route; any other key is a 400. */
const UpdateFamilySchema = CreateFamilySchema.pick({ name: true }).strict();

export function familiesRoutes(app: FastifyInstance, deps: FamiliesDeps) {
  const opts = { preHandler: app.authenticate, schema: docs.object };

  app.post("/v1/families", opts, async (req, reply) => {
    const { name } = parseOr400(CreateFamilySchema, req.body);
    const family = await createFamily(deps, { name, userId: req.user.sub });
    return reply.status(201).send(family);
  });

  app.get<{ Params: { familyId: string } }>("/v1/families/:familyId", opts, async (req) =>
    getFamily(deps, { familyId: req.params.familyId, actorId: req.user.sub }),
  );

  app.patch<{ Params: { familyId: string } }>("/v1/families/:familyId", opts, async (req) => {
    const { name } = parseOr400(UpdateFamilySchema, req.body);
    return updateFamily(deps, { familyId: req.params.familyId, actorId: req.user.sub, name });
  });
}
