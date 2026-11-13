import { and, eq, lte, sql } from "drizzle-orm";
import type { Db } from "../db.js";
import type { EventBus } from "./bus.js";
import { outbox, outboxDeliveries } from "./outbox.schema.js";
import type { DomainEvent } from "./types.js";

export const MAX_ATTEMPTS = 10;
const MAX_BACKOFF_SECONDS = 600;

export interface DrainResult {
  processed: number;
  done: number;
  failed: number;
  dead: number;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 2000);

/**
 * Deliver due pending events. Rows are claimed with FOR UPDATE SKIP LOCKED so concurrent drainers
 * never take the same event. Handlers must be idempotent (they receive the event id).
 */
export async function drainOnce(db: Db, bus: EventBus, limit = 50): Promise<DrainResult> {
  const result: DrainResult = { processed: 0, done: 0, failed: 0, dead: 0 };
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(outbox)
      .where(and(eq(outbox.status, "pending"), lte(outbox.nextAttemptAt, sql`now()`)))
      .orderBy(outbox.id)
      .limit(limit)
      .for("update", { skipLocked: true });

    for (const row of rows) {
      result.processed += 1;
      const event: DomainEvent = {
        id: row.id,
        name: row.name,
        payload: row.payload,
        occurredAt: row.occurredAt,
        ...(row.familyId ? { familyId: row.familyId } : {}),
      };
      const delivered = await tx.select().from(outboxDeliveries).where(eq(outboxDeliveries.eventId, row.id));
      const state = new Map(delivered.map((d) => [d.handler, d]));
      let firstError: string | null = null;

      for (const [handlerName, handler] of bus.handlersFor(row.name)) {
        const prev = state.get(handlerName);
        if (prev?.status === "done") continue;
        const attempt = (prev?.attempts ?? 0) + 1;
        let status = "done";
        let err: string | null = null;
        try {
          await handler(event, { db, attempt });
        } catch (e) {
          status = "pending";
          err = msg(e);
          firstError ??= `${handlerName}: ${err}`;
        }
        await tx
          .insert(outboxDeliveries)
          .values({ eventId: row.id, handler: handlerName, status, attempts: attempt, lastError: err })
          .onConflictDoUpdate({
            target: [outboxDeliveries.eventId, outboxDeliveries.handler],
            set: { status, attempts: attempt, lastError: err },
          });
      }

      if (firstError === null) {
        await tx.update(outbox).set({ status: "done", lastError: null }).where(eq(outbox.id, row.id));
        result.done += 1;
        continue;
      }
      const attempts = row.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await tx.update(outbox).set({ status: "dead", attempts, lastError: firstError }).where(eq(outbox.id, row.id));
        result.dead += 1;
      } else {
        const delay = Math.min(2 ** attempts, MAX_BACKOFF_SECONDS);
        await tx
          .update(outbox)
          .set({ attempts, lastError: firstError, nextAttemptAt: sql`now() + make_interval(secs => ${delay})` })
          .where(eq(outbox.id, row.id));
        result.failed += 1;
      }
    }
  });
  return result;
}
