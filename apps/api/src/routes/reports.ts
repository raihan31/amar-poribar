import { and, asc, eq, gte, isNull, lt, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MonthSchema, type MonthSummary } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth.js";
import { csvRow, dhakaStamp, paisaToDecimal } from "../csv.js";
import { accounts, categories, transactions } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";
import { currentDhakaMonth, monthRange, previousMonth } from "../month.js";
import { monthTotals } from "../totals.js";

type FamilyParams = { Params: { familyId: string } };

export async function reportRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  app.get<FamilyParams>("/v1/families/:familyId/reports/summary", async (req): Promise<MonthSummary> => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "viewer");
    const { month = currentDhakaMonth() } = parseOr400(z.object({ month: MonthSchema.optional() }), req.query);
    const prevMonth = previousMonth(month);
    const [totals, prev] = await Promise.all([
      monthTotals(db, familyId, req.user.sub, month),
      monthTotals(db, familyId, req.user.sub, prevMonth),
    ]);
    return {
      month,
      incomePaisa: totals.incomePaisa,
      expensePaisa: totals.expensePaisa,
      previous: { month: prevMonth, incomePaisa: prev.incomePaisa, expensePaisa: prev.expensePaisa },
      byCategory: totals.byCategory.map(({ categoryId, name, totalPaisa }) => ({ categoryId, name, totalPaisa })),
      byMember: totals.byMember,
      byAccount: totals.byAccount,
    };
  });

  // FR-REP-04 (P1): CSV for a month or a range of months. Private entries of other members are excluded (FR-TXN-05).
  app.get<FamilyParams>("/v1/families/:familyId/reports/export.csv", async (req, reply) => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "viewer");
    const q = parseOr400(
      z.object({ from: MonthSchema.optional(), to: MonthSchema.optional(), month: MonthSchema.optional() }),
      req.query,
    );
    const from = q.from ?? q.month ?? currentDhakaMonth();
    const to = q.to ?? q.month ?? from;
    if (to < from) throw new HttpError(400, "invalid_request", "`to` must not be before `from`");
    if (monthSpan(from, to) > 24) throw new HttpError(400, "invalid_request", "Range is limited to 24 months");

    const rows = await db
      .select({
        t: transactions,
        categoryEn: categories.nameEn,
        categoryBn: categories.nameBn,
        account: accounts.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .leftJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(
        and(
          eq(transactions.familyId, familyId),
          isNull(transactions.deletedAt),
          gte(transactions.occurredAt, monthRange(from).start),
          lt(transactions.occurredAt, monthRange(to).end),
          or(eq(transactions.isPrivate, false), eq(transactions.createdBy, req.user.sub)),
        ),
      )
      .orderBy(asc(transactions.occurredAt));

    const lines = [
      csvRow(["Date", "Type", "Amount (BDT)", "Fee (BDT)", "Category", "Category (বাংলা)", "Account", "Counterparty", "TrxID", "Note"]),
      ...rows.map((r) =>
        csvRow([
          dhakaStamp(r.t.occurredAt),
          r.t.type,
          paisaToDecimal(r.t.amountPaisa),
          paisaToDecimal(r.t.feePaisa),
          r.categoryEn,
          r.categoryBn,
          r.account,
          r.t.counterparty,
          r.t.trxId,
          r.t.note,
        ]),
      ),
    ];
    const name = from === to ? from : `${from}_to_${to}`;
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="amar-poribar-${name}.csv"`)
      // BOM so Excel reads the Bangla text as UTF-8.
      .send("\uFEFF" + lines.join("\r\n") + "\r\n");
  });
}

function monthSpan(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm) + 1;
}
