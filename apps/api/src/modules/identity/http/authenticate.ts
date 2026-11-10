import type { FastifyInstance, FastifyRequest } from "fastify";
import { HttpError } from "../../../platform/errors.js";

/** Decorates `app.authenticate`: 401 `unauthorized` for a missing or invalid token, and for non-access tokens. */
export function registerAuthenticate(app: FastifyInstance): void {
  app.decorate("authenticate", async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new HttpError(401, "unauthorized", "Missing or invalid token");
    }
    if (req.user.typ !== "access") throw new HttpError(401, "unauthorized", "Access token required");
  });
}
