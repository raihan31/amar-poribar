import type { FastifyInstance } from "fastify";
import { CreateTransactionSchema, ListTransactionsQuerySchema, UpdateTransactionSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { createTransaction } from "../app/create-transaction.js";
import { deleteTransaction } from "../app/delete-transaction.js";
import type { LedgerDeps } from "../app/deps.js";
import { listTransactions } from "../app/list-transactions.js";
import { updateTransaction } from "../app/update-transaction.js";
import { docs } from "../../../platform/http/responses.js";

type FamilyParams = { Params: { familyId: string } };
type TxnParams = { Params: { familyId: string; txnId: string } };

export function transactionsRoutes(app: FastifyInstance, deps: LedgerDeps) {
  const opts = { preHandler: app.authenticate };

  app.get<FamilyParams>("/v1/families/:familyId/transactions", { ...opts, schema: docs.object }, async (req) => {
    const { familyId } = req.params;
    // Viewers get summaries only, not individual entries (FR-FAM-05).
    await deps.families.requireRole(familyId, req.user.sub, "member");
    const query = parseOr400(ListTransactionsQuerySchema, req.query);
    return listTransactions(deps, { familyId, userId: req.user.sub, query });
  });

  app.post<FamilyParams>(
    "/v1/families/:familyId/transactions",
    { ...opts, schema: docs.object },
    async (req, reply) => {
      const { familyId } = req.params;
      const { role } = await deps.families.requireRole(familyId, req.user.sub, "member", { write: true });
      const data = parseOr400(CreateTransactionSchema, req.body);
      const { row, created } = await createTransaction(deps, { familyId, actor: { userId: req.user.sub, role }, data });
      return reply.status(created ? 201 : 200).send(row);
    },
  );

  app.patch<TxnParams>("/v1/families/:familyId/transactions/:txnId", { ...opts, schema: docs.object }, async (req) => {
    const { familyId, txnId } = req.params;
    const { role } = await deps.families.requireRole(familyId, req.user.sub, "member", { write: true });
    const data = parseOr400(UpdateTransactionSchema, req.body);
    return updateTransaction(deps, { familyId, txnId, actorId: req.user.sub, role, data });
  });

  app.delete<TxnParams>(
    "/v1/families/:familyId/transactions/:txnId",
    { ...opts, schema: docs.noContent },
    async (req, reply) => {
      const { familyId, txnId } = req.params;
      const { role } = await deps.families.requireRole(familyId, req.user.sub, "member", { write: true });
      await deleteTransaction(deps, { familyId, txnId, actorId: req.user.sub, role });
      return reply.status(204).send();
    },
  );
}
