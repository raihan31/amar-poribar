import { z } from "zod";
import type { Db } from "../../platform/db.js";
import { defineJob } from "../../platform/jobs/define.js";
import { createOtpRepo } from "./infra/otp-repo.js";

const HOURS_24 = 24 * 3600_000;

/** Deletes challenges created more than 24 hours before `now` (FR-PRIV-06). Returns the number removed. */
export function purgeOtp(db: Db, now: Date): Promise<number> {
  return createOtpRepo(db).purgeCreatedBefore(new Date(now.getTime() - HOURS_24));
}

export function purgeOtpJob(deps: { db: Db; clock: () => Date }) {
  return defineJob({
    name: "identity.purge-otp",
    schema: z.object({}).passthrough(),
    cron: "10 3 * * *",
    handler: async () => {
      await purgeOtp(deps.db, deps.clock());
    },
  });
}
