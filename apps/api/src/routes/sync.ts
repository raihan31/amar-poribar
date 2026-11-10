import type { FastifyInstance } from "fastify";
import { SyncRequestSchema, SyncTransactionSchema, type SyncTransaction } from "@amar-poribar/shared";
import type { AppDeps } from "../deps.js";
import { requireRole } from "../auth.js";
import { parseOr400 } from "../errors.js";
import { assertNoClockDrift } from "../modules/ledger/index.js";
import type { ModuleContext } from "../platform/module.js";

type FamilyParams = { Params: { familyId: string } };

/**
 * Exchange HLC changesets with a device (SRS §4.3.1, FR-SYNC-05). Per record, the greater HLC wins,
 * so pushing the same changes twice is harmless and the result matches device-to-device merging.
 * The merge itself lives in the ledger module; this route moves into `sync` in T-SYNC.
 */
export async function syncRoutes(app: FastifyInstance, { db }: AppDeps, ctx: ModuleContext) {
  const ledger = ctx.facades.ledger;
  if (!ledger) throw new Error("sync: ledger must be registered first");
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
        rejected.push({
          id: typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : null,
          reason: "invalid",
        });
      } else incoming.push(parsed.data);
    }

    assertNoClockDrift(incoming.map((r) => r.hlc));

    let applied = 0;
    for (const r of incoming) {
      const result = await ledger.applyChange(familyId, userId, role, r);
      if (result.status === "applied") applied++;
      else if (result.status === "rejected") rejected.push({ id: r.id, reason: result.reason });
    }

    const page = await ledger.listChangesAfter(familyId, userId, role, cursor);
    return {
      cursor: String(page.cursor),
      more: page.more,
      applied,
      rejected,
      changes: { transactions: page.changes },
    };
  });
}
