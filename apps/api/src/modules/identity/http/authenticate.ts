import type { FastifyInstance, FastifyRequest } from "fastify";
import { HttpError } from "../../../platform/errors.js";

/**
 * Decorates `app.authenticate`: 401 `unauthorized` for a missing or invalid token, for non-access tokens,
 * and for a token whose session is revoked (checked through a 30 second cache).
 */
export function registerAuthenticate(app: FastifyInstance, isSessionRevoked: (sid: string) => Promise<boolean>): void {
  app.decorate("authenticate", async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new HttpError(401, "unauthorized", "Missing or invalid token");
    }
    if (req.user.typ !== "access") throw new HttpError(401, "unauthorized", "Access token required");
    if (!req.user.sid || (await isSessionRevoked(req.user.sid))) {
      throw new HttpError(401, "unauthorized", "Session is no longer valid");
    }
  });
}
