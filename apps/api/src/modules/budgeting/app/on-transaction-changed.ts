import { currentDhakaMonth } from "../../../platform/time/month.js";
import type { TransactionCreatedV1, TransactionUpdatedV1 } from "../../ledger/index.js";
import type { AlertDeps } from "./deps.js";
import { evaluateAlerts, OVERALL } from "./evaluate-alerts.js";

/** Asia/Dhaka month of an ISO instant. */
const monthOf = (iso: string) => currentDhakaMonth(new Date(iso));

/** Handler `budgeting.evaluate` for ledger.TransactionCreated/Updated/Deleted.v1. */
export async function onTransactionChanged(
  deps: AlertDeps,
  p: TransactionCreatedV1 | TransactionUpdatedV1,
): Promise<void> {
  // Affected month -> budget keys, from the row now and, on updates, the row before.
  const affected = new Map<string, Set<string>>();
  const add = (e: { type: string; categoryId: string | null; occurredAt: string }) => {
    if (e.type !== "expense") return;
    const month = monthOf(e.occurredAt);
    const keys = affected.get(month) ?? new Set<string>([OVERALL]);
    if (e.categoryId) keys.add(e.categoryId);
    affected.set(month, keys);
  };
  add(p);
  if ("before" in p && p.before) add(p.before);
  for (const [month, keys] of affected) await evaluateAlerts(deps, p.familyId, month, keys);
}
