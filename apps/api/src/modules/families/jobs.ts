import { z } from "zod";
import type { Db } from "../../platform/db.js";
import { defineJob, type JobDefinition } from "../../platform/jobs/define.js";
import { purgeInvites } from "./app/invites.js";

export const jobs: readonly never[] = [];

/** `families.purge-invites`, daily at 03:40 Asia/Dhaka (FR-PRIV-06). Idempotent: a re-run deletes nothing more. */
export function purgeInvitesJob(deps: { db: Db; clock: () => Date }): JobDefinition {
  return defineJob({
    name: "families.purge-invites",
    schema: z.object({}).passthrough(),
    cron: "40 3 * * *",
    handler: async () => {
      await purgeInvites(deps.db, deps.clock());
    },
  });
}
