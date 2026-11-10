import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { registerAuthenticate } from "../http/authenticate.js";
import type { TokenService, TokenType } from "../app/ports.js";

const EXPIRES_IN: Record<TokenType, string> = { access: "15m", refresh: "30d" };

/**
 * Registers `@fastify/jwt` and decorates `app.authenticate`: 401 `unauthorized` for a missing or
 * invalid token, and for anything that is not an access token. Returns the token service.
 */
export async function registerJwt(app: FastifyInstance, secret: string): Promise<TokenService> {
  await app.register(fastifyJwt, { secret });
  registerAuthenticate(app);
  return {
    // TODO(P1): store refresh tokens so they can be rotated and revoked (FR-AUTH-03).
    sign: (userId, typ) => app.jwt.sign({ sub: userId, typ }, { expiresIn: EXPIRES_IN[typ] }),
    verify: (token) => app.jwt.verify<{ sub: string; typ: string }>(token),
  };
}
