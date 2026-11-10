import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CreateAccountSchema, UpdateAccountSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { createAccount, listAccounts, updateAccount } from "../app/accounts.js";
import type { LedgerDeps } from "../app/deps.js";

type FamilyParams = { Params: { familyId: string } };
type AccountParams = { Params: { familyId: string; accountId: string } };

const AccountListQuery = z.object({ includeArchived: z.stringbool().default(false) });

export function accountsRoutes(app: FastifyInstance, deps: LedgerDeps) {
  const opts = { preHandler: app.authenticate };

  app.get<FamilyParams>("/v1/families/:familyId/accounts", opts, async (req) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "viewer");
    const { includeArchived } = parseOr400(AccountListQuery, req.query);
    return listAccounts(deps, req.params.familyId, includeArchived);
  });

  app.post<FamilyParams>("/v1/families/:familyId/accounts", opts, async (req, reply) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(CreateAccountSchema, req.body);
    return reply.status(201).send(await createAccount(deps, req.params.familyId, body));
  });

  app.patch<AccountParams>("/v1/families/:familyId/accounts/:accountId", opts, async (req) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(UpdateAccountSchema, req.body);
    return updateAccount(deps, req.params.familyId, req.params.accountId, body);
  });
}
