import "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";

/** Payload of the access tokens issued by the identity module; `sid` is the session id (T-ID-05). */
export interface TokenPayload {
  sub: string;
  sid?: string;
  typ: "access";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    /** preHandler registered by the identity module: requires a valid access token and sets `req.user`. */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
