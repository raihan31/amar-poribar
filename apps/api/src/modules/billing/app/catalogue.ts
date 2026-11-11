import type { Db } from "../../../platform/db.js";
import { listActivePlans, listPlanLimits } from "../infra/catalogue-repo.js";

export interface PlanLimits {
  membersMax: number | null;
  aiEntriesMonth: number | null;
  /** null = unlimited history. */
  historyMonths: number | null;
  receiptVision: boolean;
  ask: boolean;
  exportBeyondCsv: boolean;
  multiCurrency: boolean;
  remittancePlanner: boolean;
}

export interface PlanView {
  id: string;
  nameBn: string;
  nameEn: string;
  priceMonthPaisa: number;
  priceYearPaisa: number | null;
  limits: PlanLimits;
}

type LimitRow = { key: string; intValue: number | null; boolValue: boolean | null };

export function toLimits(rows: readonly LimitRow[]): PlanLimits {
  const int = (key: string) => rows.find((r) => r.key === key)?.intValue ?? null;
  const bool = (key: string) => rows.find((r) => r.key === key)?.boolValue ?? false;
  return {
    membersMax: int("members_max"),
    aiEntriesMonth: int("ai_entries_month"),
    historyMonths: int("history_months"),
    receiptVision: bool("receipt_vision"),
    ask: bool("ask"),
    exportBeyondCsv: bool("export_beyond_csv"),
    multiCurrency: bool("multi_currency"),
    remittancePlanner: bool("remittance_planner"),
  };
}

/** Active plans in display order, each with its typed limits. */
export async function getPlanCatalogue(db: Db): Promise<PlanView[]> {
  const rows = await listActivePlans(db);
  const limits = await listPlanLimits(db);
  return rows.map((p) => ({
    id: p.id,
    nameBn: p.nameBn,
    nameEn: p.nameEn,
    priceMonthPaisa: p.priceMonthPaisa,
    priceYearPaisa: p.priceYearPaisa,
    limits: toLimits(limits.filter((l) => l.planId === p.id)),
  }));
}
