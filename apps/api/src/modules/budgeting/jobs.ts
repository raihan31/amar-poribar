import { z } from "zod";
import type { FastifyBaseLogger } from "fastify";
import type { Db } from "../../platform/db.js";
import { defineJob } from "../../platform/jobs/define.js";
import type { EventBus } from "../../platform/events/bus.js";
import type { Jobs } from "../../platform/jobs/jobs.js";
import { currentDhakaMonth } from "../../platform/time/month.js";
import { carryForwardPage } from "./app/carry-forward.js";
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

const CARRY = "budgeting.carry-forward";

/**
 * `budgeting.carry-forward`, 00:05 Asia/Dhaka on the 1st (FR-BUD-03): stores last month's budgets for the new month.
 * Works in pages of 200 families; each page queues the next one, so a long run resumes after a restart.
 * Idempotent and safe to run twice.
 */
export function carryForwardJob(deps: {
  db: Db;
  bus: EventBus;
  clock: () => Date;
  jobs: Jobs;
  logger: FastifyBaseLogger;
}) {
  return defineJob({
    name: CARRY,
    schema: z.object({ month: z.string().optional(), after: z.string().optional() }),
    cron: "5 0 1 * *",
    cronData: {},
    handler: async (data) => {
      const month = data.month ?? currentDhakaMonth(deps.clock());
      const next = await carryForwardPage(deps, month, data.after ?? null);
      if (next) await deps.jobs.send(CARRY, { month, after: next });
    },
  });
}
