import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../deps.js";
import { familyMembers, families, users } from "../db/schema.js";
import { HttpError } from "../errors.js";

// Sign-in routes live in modules/identity. `GET /v1/me` composes identity and families and moves in T-PLAT-24.
export async function authRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.get("/v1/me", { preHandler: app.authenticate }, async (req) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.sub));
    if (!user) throw new HttpError(404, "not_found", "User not found");
    const memberships = await db
      .select({ id: families.id, name: families.name, role: familyMembers.role })
      .from(familyMembers)
      .innerJoin(families, eq(families.id, familyMembers.familyId))
      .where(eq(familyMembers.userId, user.id));
    return { user, families: memberships };
  });
}
