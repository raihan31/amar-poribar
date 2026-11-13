import { z } from "zod";
import type { FastifyBaseLogger } from "fastify";
import type { Db } from "../../platform/db.js";
import { defineJob } from "../../platform/jobs/define.js";
import { alertsRepo } from "./infra/alerts.repo.js";

export const jobs: readonly never[] = [];

const KEEP_MS = 92 * 24 * 3600_000;

/** `budgeting.purge-alerts`, 04:00 Asia/Dhaka on the 1st: drops alert rows older than 3 months. Idempotent. */
export function purgeAlertsJob(deps: { db: Db; clock: () => Date; logger: FastifyBaseLogger }) {
  return defineJob({
    name: "budgeting.purge-alerts",
    schema: z.object({}).passthrough(),
    cron: "0 4 1 * *",
    handler: async () => {
      const purged = await alertsRepo.purgeOlderThan(deps.db, new Date(deps.clock().getTime() - KEEP_MS));
      deps.logger.info({ purged }, "budgeting.purge-alerts");
    },
  });
}
