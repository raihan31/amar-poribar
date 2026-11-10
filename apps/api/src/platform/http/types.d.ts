import "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";

/** Payload of the access and refresh tokens issued by the identity module. */
export interface TokenPayload {
  sub: string;
  typ: "access" | "refresh";
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
