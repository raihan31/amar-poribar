import { nextHlc } from "../../../platform/hlc.js";
import { bumpSyncSeq } from "../schema.js";

/**
 * Stamp for every write to `transactions` (FR-TXN-11): a new HLC that sorts after the row's previous one, a
 * fresh delivery number for sync, and the update time. Sync-applied rows keep the device's HLC but take the
 * same `syncSeq` and `updatedAt`, so both paths are visible to `listChangesAfter` identically.
 */
export function stampChange(prevHlc?: string | null) {
  return { hlc: nextHlc(prevHlc), syncSeq: bumpSyncSeq, updatedAt: new Date() };
}
