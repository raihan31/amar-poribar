import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { CreateFamilySchema, DEFAULT_CATEGORIES } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth.js";
import { accounts, categories, familyMembers, families } from "../db/schema.js";
import { parseOr400 } from "../errors.js";

type FamilyParams = { Params: { familyId: string } };

export async function familyRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  app.post("/v1/families", async (req, reply) => {
    const { name } = parseOr400(CreateFamilySchema, req.body);
    const userId = req.user.sub;
    const family = await db.transaction(async (tx) => {
      const [f] = await tx.insert(families).values({ name, createdBy: userId }).returning();
      await tx.insert(familyMembers).values({ familyId: f!.id, userId, role: "owner" });
      await tx.insert(categories).values(DEFAULT_CATEGORIES.map((c) => ({ ...c, familyId: f!.id })));
      await tx.insert(accounts).values([
        { familyId: f!.id, name: "Cash / নগদ", type: "cash" as const },
        { familyId: f!.id, name: "bKash", type: "bkash" as const, ownerUserId: userId },
      ]);
      return f!;
    });
    return reply.status(201).send(family);
  });

  app.get<FamilyParams>("/v1/families/:familyId/categories", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "viewer");
    return db.select().from(categories).where(eq(categories.familyId, req.params.familyId));
  });

  app.get<FamilyParams>("/v1/families/:familyId/accounts", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "viewer");
    return db.select().from(accounts).where(eq(accounts.familyId, req.params.familyId));
  });
}
