import { and, asc, eq, gt, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { SyncRequestSchema, SyncTransactionSchema, type SyncTransaction } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { canEditAll, requireRole } from "../auth.js";
import { accounts, bumpSyncSeq, categories, transactions } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";
import { ClockDriftError, formatHlc, parseHlc, receiveHlc, winsOver } from "../hlc.js";

type FamilyParams = { Params: { familyId: string } };

const PAGE = 500;

/** Postgres unique violation (23505). Drizzle wraps driver errors, so the code may be on `cause`. */
function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) => (x as { code?: string } | null | undefined)?.code;
  return code(e) === "23505" || code((e as { cause?: unknown } | null)?.cause) === "23505";
}

type Row = typeof transactions.$inferSelect;

function toWire(r: Row): SyncTransaction {
  return {
    id: r.id,
    type: r.type,
    amountPaisa: r.amountPaisa,
    feePaisa: r.feePaisa,
    occurredAt: r.occurredAt.toISOString(),
    categoryId: r.categoryId,
    accountId: r.accountId,
    note: r.note,
    counterparty: r.counterparty,
    trxId: r.trxId,
    source: r.source,
    isPrivate: r.isPrivate,
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
    hlc: r.hlc,
  };
}

/**
 * Exchange HLC changesets with a device (SRS §4.3.1, FR-SYNC-05). Per record, the greater HLC wins,
 * so pushing the same changes twice is harmless and the result matches device-to-device merging.
 */
export async function syncRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  app.post<FamilyParams>("/v1/families/:familyId/sync", { bodyLimit: 2 * 1024 * 1024 }, async (req) => {
    const { familyId } = req.params;
    const userId = req.user.sub;
    // Viewers are summary-only (FR-FAM-05): they neither push nor receive individual entries.
    const role = await requireRole(db, familyId, userId, "member");
    const body = parseOr400(SyncRequestSchema, req.body);
    const cursor = body.cursor ? Number(body.cursor) : 0;

    // Validate each pushed row on its own so one bad row doesn't discard the batch.
    const rejected: { id: string | null; reason: string }[] = [];
    const incoming: SyncTransaction[] = [];
    for (const raw of body.changes.transactions) {
      const parsed = SyncTransactionSchema.safeParse(raw);
      if (!parsed.success) {
        rejected.push({ id: typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : null, reason: "invalid" });
      } else incoming.push(parsed.data);
    }

    // One device with a wrong clock must not overwrite everyone's data (24h limit).
    const nowMs = Date.now();
    let probe = parseHlc(formatHlc({ time: nowMs, counter: 0, node: "server" }));
    try {
      for (const r of incoming) probe = receiveHlc(probe, parseHlc(r.hlc), nowMs);
    } catch (e) {
      if (e instanceof ClockDriftError) throw new HttpError(400, "clock_drift", "This device's clock is too far ahead; fix the date and time, then sync again");
      throw e;
    }

    const ownCats = new Set((await db.select({ id: categories.id }).from(categories).where(eq(categories.familyId, familyId))).map((c) => c.id));
    const ownAccs = new Set((await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.familyId, familyId))).map((a) => a.id));

    let applied = 0;
    for (const r of incoming) {
      // References must belong to this family (tenant isolation, NFR-06).
      if ((r.categoryId && !ownCats.has(r.categoryId)) || (r.accountId && !ownAccs.has(r.accountId))) {
        rejected.push({ id: r.id, reason: "unknown_reference" });
        continue;
      }
      try {
        // Savepoint per row: a duplicate TrxID rejects that row only.
        await db.transaction(async (tx) => {
          const [existing] = await tx.select().from(transactions).where(eq(transactions.id, r.id)).for("update");
          if (existing && existing.familyId !== familyId) throw new HttpError(409, "id_taken", "id_taken");
          if (existing && !winsOver(r.hlc, existing.hlc)) return; // older or equal: nothing to do
          if (existing && existing.createdBy !== userId && !canEditAll(role)) throw new HttpError(403, "forbidden", "forbidden");
          const values = {
            type: r.type,
            amountPaisa: r.amountPaisa,
            feePaisa: r.feePaisa,
            occurredAt: new Date(r.occurredAt),
            categoryId: r.categoryId ?? null,
            accountId: r.accountId ?? null,
            note: r.note ?? null,
            counterparty: r.counterparty ?? null,
            trxId: r.trxId ?? null,
            source: r.source,
            isPrivate: r.isPrivate,
            deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
            hlc: r.hlc,
            syncSeq: bumpSyncSeq,
            updatedAt: new Date(),
          };
          if (existing) await tx.update(transactions).set(values).where(eq(transactions.id, r.id));
          else await tx.insert(transactions).values({ ...values, id: r.id, familyId, paidByUserId: userId, createdBy: userId });
          applied++;
        });
      } catch (e) {
        if (e instanceof HttpError) rejected.push({ id: r.id, reason: e.code === "forbidden" ? "forbidden" : "id_taken" });
        else if (isUniqueViolation(e)) rejected.push({ id: r.id, reason: "duplicate_trx_id" });
        else throw e;
      }
    }

    // Everything the device has not downloaded yet, by delivery order (not HLC), tombstones included.
    const rows = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.familyId, familyId),
          cursor > 0 ? gt(transactions.syncSeq, cursor) : undefined,
          // Other members' private entries are never sent (FR-TXN-05).
          or(eq(transactions.isPrivate, false), eq(transactions.createdBy, userId)),
        ),
      )
      .orderBy(asc(transactions.syncSeq))
      .limit(PAGE + 1);
    const more = rows.length > PAGE;
    const page = rows.slice(0, PAGE);
    return {
      cursor: String(page.at(-1)?.syncSeq ?? cursor),
      more,
      applied,
      rejected,
      changes: { transactions: page.map(toWire) },
    };
  });
}
