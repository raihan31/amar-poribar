import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CreateTransactionSchema, MonthSchema, UpdateTransactionSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { createTransaction } from "../app/create-transaction.js";
import { deleteTransaction } from "../app/delete-transaction.js";
import type { LedgerDeps } from "../app/deps.js";
import { listTransactions } from "../app/list-transactions.js";
import { updateTransaction } from "../app/update-transaction.js";
import { docs } from "../../../platform/http/responses.js";

type FamilyParams = { Params: { familyId: string } };
type TxnParams = { Params: { familyId: string; txnId: string } };

const ListQuerySchema = z.object({ month: MonthSchema.optional() });

export function transactionsRoutes(app: FastifyInstance, deps: LedgerDeps) {
  const opts = { preHandler: app.authenticate };

  app.get<FamilyParams>("/v1/families/:familyId/transactions", { ...opts, schema: docs.list }, async (req) => {
    const { familyId } = req.params;
    // Viewers get summaries only, not individual entries (FR-FAM-05).
    await deps.families.requireRole(familyId, req.user.sub, "member");
    const { month } = parseOr400(ListQuerySchema, req.query);
    return listTransactions(deps, { familyId, userId: req.user.sub, month });
  });

  app.post<FamilyParams>(
    "/v1/families/:familyId/transactions",
    { ...opts, schema: docs.object },
    async (req, reply) => {
      const { familyId } = req.params;
      await deps.families.requireRole(familyId, req.user.sub, "member");
      const data = parseOr400(CreateTransactionSchema, req.body);
      const row = await createTransaction(deps, { familyId, actorId: req.user.sub, data });
      return reply.status(201).send(row);
    },
  );

  app.patch<TxnParams>("/v1/families/:familyId/transactions/:txnId", { ...opts, schema: docs.object }, async (req) => {
    const { familyId, txnId } = req.params;
    const { role } = await deps.families.requireRole(familyId, req.user.sub, "member");
    const data = parseOr400(UpdateTransactionSchema, req.body);
    return updateTransaction(deps, { familyId, txnId, actorId: req.user.sub, role, data });
  });

  app.delete<TxnParams>(
    "/v1/families/:familyId/transactions/:txnId",
    { ...opts, schema: docs.noContent },
    async (req, reply) => {
      const { familyId, txnId } = req.params;
      const { role } = await deps.families.requireRole(familyId, req.user.sub, "member");
      await deleteTransaction(deps, { familyId, txnId, actorId: req.user.sub, role });
      return reply.status(204).send();
    },
  );
}
