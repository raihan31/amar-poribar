import { z } from "zod";
import type { FastifyBaseLogger } from "fastify";
import type { Db } from "../../platform/db.js";
import { defineJob } from "../../platform/jobs/define.js";
import { storageKeys } from "../../platform/storage/keys.js";
import type { ObjectStorage } from "../../platform/storage/storage.js";
import { transactionsRepo } from "./infra/transactions.repo.js";

export const jobs: readonly never[] = [];

/** One day beyond the 30-day restore window, so sync tombstones live at least 30 days (SRS 4.3.1). */
const PURGE_AFTER_MS = 31 * 24 * 3600_000;
const BATCH = 500;

/** Deletes transactions soft-deleted more than 31 days before `now`, receipt objects first. Returns the count. */
export async function purgeDeleted(deps: { db: Db; storage: ObjectStorage }, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - PURGE_AFTER_MS);
  let purged = 0;
  for (;;) {
    const batch = await transactionsRepo.staleTombstones(deps.db, cutoff, BATCH);
    if (batch.length === 0) break;
    // Objects go first: a crash leaves rows to retry, never orphaned objects.
    for (const r of batch) await deps.storage.delete(storageKeys.receipt(r.familyId, r.id));
    await transactionsRepo.purgeTombstones(
      deps.db,
      batch.map((r) => r.id),
      cutoff,
    );
    purged += batch.length;
    if (batch.length < BATCH) break;
  }
  return purged;
}

/** `ledger.purge-deleted`, daily at 03:15 Asia/Dhaka (FR-PRIV-06). Idempotent. */
export function purgeDeletedJob(deps: {
  db: Db;
  storage: ObjectStorage;
  clock: () => Date;
  logger: FastifyBaseLogger;
  onPurged?: ((n: number) => void) | undefined;
}) {
  return defineJob({
    name: "ledger.purge-deleted",
    schema: z.object({}).passthrough(),
    cron: "15 3 * * *",
    handler: async () => {
      const purged = await purgeDeleted(deps, deps.clock());
      deps.logger.info({ purged }, "ledger.purge-deleted");
      deps.onPurged?.(purged);
    },
  });
}
