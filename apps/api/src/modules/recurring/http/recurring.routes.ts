import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CreateRecurringSchema, MonthSchema, UpdateRecurringSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { currentDhakaMonth } from "../../ledger/index.js";
import { confirmDraft } from "../app/confirm-draft.js";
import type { RecurringDeps } from "../app/deps.js";
import { listDrafts } from "../app/list-drafts.js";
import { listReminders } from "../app/reminders.js";
import { createTemplate, listTemplates, updateTemplate } from "../app/templates.js";
import { docs } from "../../../platform/http/responses.js";

type FamilyParams = { Params: { familyId: string } };
type RecurringParams = { Params: { familyId: string; recurringId: string } };

const MonthQuery = z.object({ month: MonthSchema.optional() });
const todayDhaka = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

export function recurringRoutes(app: FastifyInstance, deps: RecurringDeps) {
  const opts = { preHandler: app.authenticate };

  app.get<FamilyParams>("/v1/families/:familyId/recurring", { ...opts, schema: docs.list }, async (req) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "viewer");
    return listTemplates(deps, req.params.familyId);
  });

  app.post<FamilyParams>("/v1/families/:familyId/recurring", { ...opts, schema: docs.object }, async (req, reply) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "admin", { write: true });
    const body = parseOr400(CreateRecurringSchema, req.body);
    return reply.status(201).send(await createTemplate(deps, req.params.familyId, req.user.sub, body));
  });

  app.patch<RecurringParams>(
    "/v1/families/:familyId/recurring/:recurringId",
    { ...opts, schema: docs.object },
    async (req) => {
      await deps.families.requireRole(req.params.familyId, req.user.sub, "admin", { write: true });
      const body = parseOr400(UpdateRecurringSchema, req.body);
      return updateTemplate(deps, req.params.familyId, req.params.recurringId, body);
    },
  );

  app.get<FamilyParams>("/v1/families/:familyId/recurring/drafts", { ...opts, schema: docs.object }, async (req) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "viewer");
    const { month = currentDhakaMonth() } = parseOr400(MonthQuery, req.query);
    return listDrafts(deps, req.params.familyId, month);
  });

  app.get<FamilyParams>("/v1/families/:familyId/recurring/reminders", { ...opts, schema: docs.list }, async (req) => {
    await deps.families.requireRole(req.params.familyId, req.user.sub, "viewer");
    return listReminders(deps, req.params.familyId, todayDhaka());
  });

  app.post<RecurringParams>(
    "/v1/families/:familyId/recurring/:recurringId/confirm",
    { ...opts, schema: docs.object },
    async (req, reply) => {
      const { familyId, recurringId } = req.params;
      await deps.families.requireRole(familyId, req.user.sub, "member", { write: true });
      const { month = currentDhakaMonth() } = parseOr400(MonthQuery, req.query);
      const txn = await confirmDraft(deps, { familyId, templateId: recurringId, userId: req.user.sub, month });
      return reply.status(201).send(txn);
    },
  );
}
