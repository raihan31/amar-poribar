import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CreateRecurringSchema, MonthSchema, UpdateRecurringSchema } from "@amar-poribar/shared";
import type { AppDeps } from "../deps.js";
import { requireRole } from "../auth.js";
import { accounts, categories, recurringTemplates, transactions } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";
import { nextHlc } from "../modules/ledger/index.js";
import { currentDhakaMonth } from "../month.js";
import { dueDateIn, isDueIn, reminderState } from "../recurring.js";

type FamilyParams = { Params: { familyId: string } };
type RecurringParams = { Params: { familyId: string; recurringId: string } };

const todayDhaka = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

export async function recurringRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  async function assertRefs(familyId: string, refs: { categoryId?: string | null; accountId?: string | null }) {
    if (refs.categoryId) {
      const [c] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, refs.categoryId), eq(categories.familyId, familyId)));
      if (!c) throw new HttpError(400, "invalid_category", "Unknown category");
    }
    if (refs.accountId) {
      const [a] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, refs.accountId), eq(accounts.familyId, familyId)));
      if (!a) throw new HttpError(400, "invalid_account", "Unknown account");
    }
  }

  app.get<FamilyParams>("/v1/families/:familyId/recurring", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "viewer");
    return db.select().from(recurringTemplates).where(eq(recurringTemplates.familyId, req.params.familyId));
  });

  app.post<FamilyParams>("/v1/families/:familyId/recurring", async (req, reply) => {
    await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(CreateRecurringSchema, req.body);
    await assertRefs(req.params.familyId, body);
    const [row] = await db
      .insert(recurringTemplates)
      .values({ ...body, endsOn: body.endsOn ?? null, familyId: req.params.familyId, createdBy: req.user.sub })
      .returning();
    return reply.status(201).send(row);
  });

  app.patch<RecurringParams>("/v1/families/:familyId/recurring/:recurringId", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(UpdateRecurringSchema, req.body);
    await assertRefs(req.params.familyId, body);
    const [row] = await db
      .update(recurringTemplates)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(eq(recurringTemplates.id, req.params.recurringId), eq(recurringTemplates.familyId, req.params.familyId)),
      )
      .returning();
    if (!row) throw new HttpError(404, "not_found", "Recurring entry not found");
    return row;
  });

  /** Drafts for a month: templates due and not yet confirmed (FR-TXN-06). The user confirms each one. */
  app.get<FamilyParams>("/v1/families/:familyId/recurring/drafts", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "viewer");
    const { month = currentDhakaMonth() } = parseOr400(z.object({ month: MonthSchema.optional() }), req.query);
    const rows = await db.select().from(recurringTemplates).where(eq(recurringTemplates.familyId, req.params.familyId));
    return {
      month,
      drafts: rows.filter((t) => isDueIn(t, month)).map((t) => ({ ...t, dueOn: dueDateIn(month, t.dayOfMonth) })),
    };
  });

  /** Upcoming and overdue bills for reminders (FR-NOT-03). Delivery by push is separate. */
  app.get<FamilyParams>("/v1/families/:familyId/recurring/reminders", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "viewer");
    const today = todayDhaka();
    const rows = await db.select().from(recurringTemplates).where(eq(recurringTemplates.familyId, req.params.familyId));
    return rows.flatMap((t) => {
      const r = reminderState(t, today);
      return r ? [{ id: t.id, name: t.name, amountPaisa: t.amountPaisa, dueOn: r.due, daysUntil: r.daysUntil }] : [];
    });
  });

  /** Confirm the draft for a month: records the transaction once (a second call returns 409). */
  app.post<RecurringParams>("/v1/families/:familyId/recurring/:recurringId/confirm", async (req, reply) => {
    const { familyId, recurringId } = req.params;
    await requireRole(db, familyId, req.user.sub, "member");
    const { month = currentDhakaMonth() } = parseOr400(z.object({ month: MonthSchema.optional() }), req.query);
    const txn = await db.transaction(async (tx) => {
      const [t] = await tx
        .select()
        .from(recurringTemplates)
        .where(and(eq(recurringTemplates.id, recurringId), eq(recurringTemplates.familyId, familyId)))
        .for("update");
      if (!t) throw new HttpError(404, "not_found", "Recurring entry not found");
      if (!isDueIn(t, month)) throw new HttpError(409, "not_due", "Nothing to confirm for this month");
      const [row] = await tx
        .insert(transactions)
        .values({
          familyId,
          type: t.type,
          amountPaisa: t.amountPaisa,
          occurredAt: new Date(`${dueDateIn(month, t.dayOfMonth)}T12:00:00+06:00`),
          categoryId: t.categoryId,
          accountId: t.accountId,
          note: t.name,
          source: "manual",
          paidByUserId: req.user.sub,
          createdBy: req.user.sub,
          hlc: nextHlc(),
        })
        .returning();
      await tx
        .update(recurringTemplates)
        .set({ lastConfirmedMonth: month })
        .where(eq(recurringTemplates.id, recurringId));
      return row;
    });
    return reply.status(201).send(txn);
  });
}
