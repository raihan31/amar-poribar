import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import type { TokenService } from "../app/ports.js";

/** Registers `@fastify/jwt` and returns the token service. `authenticate` is registered separately (needs sessions). */
export async function registerJwt(app: FastifyInstance, secret: string): Promise<TokenService> {
  await app.register(fastifyJwt, { secret });
  return {
    sign: (userId, sid) => app.jwt.sign({ sub: userId, sid, typ: "access" }, { expiresIn: "15m" }),
    verify: (token) => app.jwt.verify<{ sub: string; typ: string; sid?: string }>(token),
  };
}
