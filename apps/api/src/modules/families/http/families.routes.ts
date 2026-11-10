import type { FastifyInstance } from "fastify";
import { CreateFamilySchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { createFamily } from "../app/create-family.js";
import type { FamiliesDeps } from "../app/deps.js";

export function familiesRoutes(app: FastifyInstance, deps: FamiliesDeps) {
  app.post("/v1/families", { preHandler: app.authenticate }, async (req, reply) => {
    const { name } = parseOr400(CreateFamilySchema, req.body);
    const family = await createFamily(deps, { name, userId: req.user.sub });
    return reply.status(201).send(family);
  });
}
