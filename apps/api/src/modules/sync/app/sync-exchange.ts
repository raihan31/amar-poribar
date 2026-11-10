import { SyncTransactionSchema, type SyncRequest, type SyncTransaction } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { ClockDriftError, formatHlc, parseHlc, receiveHlc } from "../../../platform/hlc.js";
import type { FamiliesFacade } from "../../families/index.js";
import type { LedgerFacade } from "../../ledger/index.js";
import { formatCursor, parseCursor } from "../domain/cursor.js";

/** Rows per page of changes sent to a device. */
export const PAGE = 500;

export interface SyncDeps {
  families: FamiliesFacade;
  ledger: LedgerFacade;
}

export interface SyncResponse {
  cursor: string;
  more: boolean;
  applied: number;
  rejected: { id: string | null; reason: string }[];
  changes: { transactions: SyncTransaction[] };
}

/** One device with a wrong clock must not overwrite everyone's data (24h limit, SRS §4.3.1). */
export function assertNoClockDrift(hlcs: readonly string[], nowMs: number = Date.now()): void {
  let probe = parseHlc(formatHlc({ time: nowMs, counter: 0, node: "server" }));
  try {
    for (const h of hlcs) probe = receiveHlc(probe, parseHlc(h), nowMs);
  } catch (e) {
    if (e instanceof ClockDriftError) {
      throw new HttpError(
        400,
        "clock_drift",
        "This device's clock is too far ahead; fix the date and time, then sync again",
      );
    }
    throw e;
  }
}

/**
 * Exchange HLC changesets with a device (SRS §4.3.1, FR-SYNC-05). Per record, the greater HLC wins,
 * so pushing the same changes twice is harmless and the result matches device-to-device merging.
 */
export async function syncExchange(
  deps: SyncDeps,
  familyId: string,
  userId: string,
  body: SyncRequest,
): Promise<SyncResponse> {
  // Viewers are summary-only (FR-FAM-05): they neither push nor receive individual entries.
  const role = await deps.families.requireRole(familyId, userId, "member");
  const cursor = parseCursor(body.cursor);

  // Validate each pushed row on its own so one bad row doesn't discard the batch.
  const rejected: SyncResponse["rejected"] = [];
  const incoming: SyncTransaction[] = [];
  for (const raw of body.changes.transactions) {
    const parsed = SyncTransactionSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({
        id: typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : null,
        reason: "invalid",
      });
    } else incoming.push(parsed.data);
  }

  assertNoClockDrift(incoming.map((r) => r.hlc));

  let applied = 0;
  for (const r of incoming) {
    const result = await deps.ledger.applyChange(familyId, userId, role, r);
    if (result.status === "applied") applied++;
    else if (result.status === "rejected") rejected.push({ id: r.id, reason: result.reason });
  }

  const page = await deps.ledger.listChangesAfter(familyId, userId, role, cursor, PAGE);
  return {
    cursor: formatCursor(page.cursor),
    more: page.more,
    applied,
    rejected,
    changes: { transactions: page.changes },
  };
}
