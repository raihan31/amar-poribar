import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MonthSchema, type MonthSummary } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { currentDhakaMonth } from "../../../platform/time/month.js";
import type { ReportingDeps } from "../app/deps.js";
import { exportCsv } from "../app/export-csv.js";
import { monthSummary } from "../app/month-summary.js";
import { remittances } from "../app/remittances.js";
import { docs } from "../../../platform/http/responses.js";

type FamilyParams = { Params: { familyId: string } };

export function reportsRoutes(app: FastifyInstance, deps: ReportingDeps) {
  const opts = { preHandler: app.authenticate };

  app.get<FamilyParams>(
    "/v1/families/:familyId/reports/summary",
    { ...opts, schema: docs.object },
    async (req): Promise<MonthSummary> => {
      const { familyId } = req.params;
      await deps.families.requireRole(familyId, req.user.sub, "viewer");
      const { month = currentDhakaMonth() } = parseOr400(z.object({ month: MonthSchema.optional() }), req.query);
      return monthSummary(deps, familyId, req.user.sub, month);
    },
  );

  app.get<FamilyParams>("/v1/families/:familyId/reports/remittances", { ...opts, schema: docs.object }, async (req) => {
    const { familyId } = req.params;
    await deps.families.requireRole(familyId, req.user.sub, "viewer");
    const q = parseOr400(z.object({ from: MonthSchema.optional(), to: MonthSchema.optional() }), req.query);
    return remittances(deps, familyId, req.user.sub, q);
  });

  app.get<FamilyParams>(
    "/v1/families/:familyId/reports/export.csv",
    { ...opts, schema: docs.text },
    async (req, reply) => {
      const { familyId } = req.params;
      // Viewers (for example expatriate members) see summaries only, not individual entries (FR-FAM-05).
      await deps.families.requireRole(familyId, req.user.sub, "member");
      const q = parseOr400(
        z.object({ from: MonthSchema.optional(), to: MonthSchema.optional(), month: MonthSchema.optional() }),
        req.query,
      );
      const { filename, body } = await exportCsv(deps, familyId, req.user.sub, q);
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="${filename}"`)
        .send(body);
    },
  );
}
