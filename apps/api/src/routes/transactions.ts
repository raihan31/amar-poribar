import { and, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CreateTransactionSchema, MonthSchema } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { canEditAll, requireRole } from "../auth.js";
import { accounts, categories, transactions } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";
import { monthRange } from "../month.js";

type FamilyParams = { Params: { familyId: string } };
type TxnParams = { Params: { familyId: string; txnId: string } };

const ListQuerySchema = z.object({ month: MonthSchema.optional() });

export async function transactionRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  /** Rows the caller may see: not deleted, and not someone else's private entry (FR-TXN-05). */
  const visibleTo = (familyId: string, userId: string) =>
    and(
      eq(transactions.familyId, familyId),
      isNull(transactions.deletedAt),
      or(eq(transactions.isPrivate, false), eq(transactions.createdBy, userId)),
    );

  app.get<FamilyParams>("/v1/families/:familyId/transactions", async (req) => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "viewer");
    const { month } = parseOr400(ListQuerySchema, req.query);
    const conditions = [visibleTo(familyId, req.user.sub)];
    if (month) {
      const { start, end } = monthRange(month);
      conditions.push(gte(transactions.occurredAt, start), lt(transactions.occurredAt, end));
    }
    // TODO(P1): cursor pagination (FR-TXN-02).
    return db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredAt))
      .limit(200);
  });

  app.post<FamilyParams>("/v1/families/:familyId/transactions", async (req, reply) => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "member");
    const input = parseOr400(CreateTransactionSchema, req.body);

    // Category and account must belong to this family (tenant isolation, NFR-06).
    if (input.categoryId) {
      const [c] = await db.select({ id: categories.id }).from(categories)
        .where(and(eq(categories.id, input.categoryId), eq(categories.familyId, familyId)));
      if (!c) throw new HttpError(400, "invalid_category", "Unknown category");
    }
    if (input.accountId) {
      const [a] = await db.select({ id: accounts.id }).from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.familyId, familyId)));
      if (!a) throw new HttpError(400, "invalid_account", "Unknown account");
    }

    const [row] = await db
      .insert(transactions)
      .values({
        ...input,
        occurredAt: new Date(input.occurredAt),
        familyId,
        paidByUserId: req.user.sub,
        createdBy: req.user.sub,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new HttpError(409, "duplicate", "This transaction (TrxID or id) is already recorded");
    return reply.status(201).send(row);
  });

  app.delete<TxnParams>("/v1/families/:familyId/transactions/:txnId", async (req, reply) => {
    const { familyId, txnId } = req.params;
    const role = await requireRole(db, familyId, req.user.sub, "member");
    const [txn] = await db.select().from(transactions)
      .where(and(eq(transactions.id, txnId), visibleTo(familyId, req.user.sub)));
    if (!txn) throw new HttpError(404, "not_found", "Transaction not found");
    if (txn.createdBy !== req.user.sub && !canEditAll(role)) {
      throw new HttpError(403, "forbidden", "You can only delete your own entries");
    }
    await db.update(transactions).set({ deletedAt: sql`now()` }).where(eq(transactions.id, txnId));
    return reply.status(204).send();
  });
}
