import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { CreateFestivalBudgetSchema, UpdateFestivalBudgetSchema } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth.js";
import { budgetLevel } from "../budgets.js";
import { festivalBudgets, transactions } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";
import { dayRange } from "../month.js";

type FamilyParams = { Params: { familyId: string } };
type FestivalParams = { Params: { familyId: string; festivalId: string } };

/** Festival budgets (Eid, Puja): a spending limit over a date range (FR-BUD-04). */
export async function festivalRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  app.get<FamilyParams>("/v1/families/:familyId/festival-budgets", async (req) => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "viewer");
    const rows = await db.select().from(festivalBudgets).where(eq(festivalBudgets.familyId, familyId));
    return Promise.all(
      rows
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
        .map(async (f) => {
          const { start, end } = dayRange(f.startsOn, f.endsOn);
          const [spent] = await db
            .select({ total: sql<string>`coalesce(sum(${transactions.amountPaisa} + ${transactions.feePaisa}), 0)` })
            .from(transactions)
            .where(
              and(
                eq(transactions.familyId, familyId),
                eq(transactions.type, "expense"),
                isNull(transactions.deletedAt),
                gte(transactions.occurredAt, start),
                lt(transactions.occurredAt, end),
                or(eq(transactions.isPrivate, false), eq(transactions.createdBy, req.user.sub)),
              ),
            );
          const spentPaisa = Number(spent?.total ?? 0);
          return { ...f, spentPaisa, level: budgetLevel(spentPaisa, f.limitPaisa) };
        }),
    );
  });

  app.post<FamilyParams>("/v1/families/:familyId/festival-budgets", async (req, reply) => {
    await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(CreateFestivalBudgetSchema, req.body);
    const [row] = await db.insert(festivalBudgets).values({ ...body, familyId: req.params.familyId }).returning();
    return reply.status(201).send(row);
  });

  app.patch<FestivalParams>("/v1/families/:familyId/festival-budgets/:festivalId", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(UpdateFestivalBudgetSchema, req.body);
    const where = and(eq(festivalBudgets.id, req.params.festivalId), eq(festivalBudgets.familyId, req.params.familyId));
    const [current] = await db.select().from(festivalBudgets).where(where);
    if (!current) throw new HttpError(404, "not_found", "Festival budget not found");
    // The range must still be valid after a partial update.
    const startsOn = body.startsOn ?? current.startsOn;
    const endsOn = body.endsOn ?? current.endsOn;
    if (endsOn < startsOn) throw new HttpError(400, "invalid_request", "endsOn must not be before startsOn");
    const [row] = await db.update(festivalBudgets).set({ ...body, updatedAt: new Date() }).where(where).returning();
    return row;
  });

  app.delete<FestivalParams>("/v1/families/:familyId/festival-budgets/:festivalId", async (req, reply) => {
    await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const deleted = await db
      .delete(festivalBudgets)
      .where(and(eq(festivalBudgets.id, req.params.festivalId), eq(festivalBudgets.familyId, req.params.familyId)))
      .returning({ id: festivalBudgets.id });
    if (!deleted.length) throw new HttpError(404, "not_found", "Festival budget not found");
    return reply.status(204).send();
  });
}
