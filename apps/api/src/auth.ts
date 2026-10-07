import fastifyJwt from "@fastify/jwt";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@amar-poribar/shared";
import type { Db } from "./db/client.js";
import { familyMembers } from "./db/schema.js";
import { HttpError } from "./errors.js";

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
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function registerAuth(app: FastifyInstance, secret: string) {
  await app.register(fastifyJwt, { secret });
  app.decorate("authenticate", async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new HttpError(401, "unauthorized", "Missing or invalid token");
    }
    if (req.user.typ !== "access") throw new HttpError(401, "unauthorized", "Access token required");
  });
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

/**
 * Ensure the user belongs to the family with at least `minRole`.
 * Non-members get 404 so family IDs can't be probed (SRS acceptance #7).
 */
export async function requireRole(db: Db, familyId: string, userId: string, minRole: Role): Promise<Role> {
  const [row] = await db
    .select({ role: familyMembers.role })
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
  if (!row) throw new HttpError(404, "not_found", "Family not found");
  if (ROLE_RANK[row.role] < ROLE_RANK[minRole]) throw new HttpError(403, "forbidden", "Insufficient role");
  return row.role;
}

export function canEditAll(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.admin;
}
