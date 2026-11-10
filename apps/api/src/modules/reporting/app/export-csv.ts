import { HttpError } from "../../../platform/errors.js";
import { currentDhakaMonth, monthRange, monthsBetween } from "../../../platform/time/month.js";
import { csvRow, dhakaStamp, paisaToDecimal } from "../domain/csv.js";
import type { ReportingDeps } from "./deps.js";

const HEADER = [
  "Date",
  "Type",
  "Amount (BDT)",
  "Fee (BDT)",
  "Category",
  "Category (বাংলা)",
  "Account",
  "Counterparty",
  "TrxID",
  "Note",
];

/** FR-REP-04: CSV for a month or a range of months. Other members' private entries are excluded (FR-TXN-05). */
export async function exportCsv(
  deps: Pick<ReportingDeps, "ledger">,
  familyId: string,
  userId: string,
  query: { from?: string | undefined; to?: string | undefined; month?: string | undefined },
): Promise<{ filename: string; body: string }> {
  const from = query.from ?? query.month ?? currentDhakaMonth();
  const to = query.to ?? query.month ?? from;
  if (to < from) throw new HttpError(400, "invalid_request", "`to` must not be before `from`");
  if (monthsBetween(from, to).length > 24) throw new HttpError(400, "invalid_request", "Range is limited to 24 months");

  const lines = [csvRow(HEADER)];
  const range = { start: monthRange(from).start, end: monthRange(to).end };
  for await (const r of deps.ledger.listForExport(familyId, userId, range)) {
    lines.push(
      csvRow([
        dhakaStamp(r.occurredAt),
        r.type,
        paisaToDecimal(r.amountPaisa),
        paisaToDecimal(r.feePaisa),
        r.categoryEn,
        r.categoryBn,
        r.accountName,
        r.counterparty,
        r.trxId,
        r.note,
      ]),
    );
  }
  const name = from === to ? from : `${from}_to_${to}`;
  // BOM so Excel reads the Bangla text as UTF-8.
  return { filename: `amar-poribar-${name}.csv`, body: "﻿" + lines.join("\r\n") + "\r\n" };
}
