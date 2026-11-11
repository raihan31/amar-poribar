import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import { logout, logoutAll, type LogoutDeps } from "../app/logout.js";

const LogoutSchema = z.object({
  refreshToken: z.string().optional(),
  deviceId: z.string().min(1).max(200).optional(),
});

export function logoutRoutes(app: FastifyInstance, deps: LogoutDeps): void {
  app.post("/v1/auth/logout", { preHandler: app.authenticate, schema: docs.noContent }, async (req, reply) => {
    const { deviceId } = parseOr400(LogoutSchema, req.body ?? {});
    await logout(deps, { userId: req.user.sub, sessionId: req.user.sid! }, deviceId);
    return reply.code(204).send();
  });

  app.post("/v1/auth/logout-all", { preHandler: app.authenticate, schema: docs.noContent }, async (req, reply) => {
    await logoutAll(deps, req.user.sub);
    return reply.code(204).send();
  });
}
