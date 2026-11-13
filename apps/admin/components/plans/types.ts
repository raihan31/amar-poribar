import { fmtTaka } from "@/components/family/types";

export type PlanId = "free" | "plus" | "probashi";

export interface PlanRow {
  id: PlanId;
  name: string;
  families: number;
  /** Integer paisa. */
  priceMonthPaisa: number;
  priceYearPaisa: number | null;
  memberLimit: number | null;
  aiQuotaMonth: number;
  /** Plain-language limits shown on the card, supplied by the API. */
  summary: string[];
}

export interface AiCost {
  /** Integer paisa per active family this month. */
  perFamilyPaisa: number;
  /** NFR-13 goal in integer paisa. */
  goalPaisa: number;
}

export interface NearQuotaRow {
  familyId: string;
  familyName: string;
  plan: PlanId;
  used: number;
  limit: number;
  resetsOn: string;
}

export interface PlansResponse {
  plans: PlanRow[];
  aiCost: AiCost;
  nearQuota: NearQuotaRow[];
}

export interface PlanChange {
  aiQuotaMonth?: number;
  priceMonthPaisa?: number;
  memberLimit?: number;
}

export const PLAN_NAME: Record<PlanId, string> = { free: "Free", plus: "Plus", probashi: "Probashi" };

export const fmtCount = (n: number) => n.toLocaleString("en-US");

/** Whole-percent of used over limit, integer maths only. */
export const pctOf = (used: number, limit: number) => (limit > 0 ? Math.floor((used * 100) / limit) : 0);

export function priceText(p: PlanRow): string {
  if (p.priceMonthPaisa === 0) return "৳ 0";
  const month = `${fmtTaka(p.priceMonthPaisa)} / month`;
  return p.priceYearPaisa ? `${month} · ${fmtTaka(p.priceYearPaisa)} / year` : month;
}

/** Fixture reproducing the AdminPlans design counts. */
export const plansFixture: PlansResponse = {
  plans: [
    {
      id: "free",
      name: "Free",
      families: 1021,
      priceMonthPaisa: 0,
      priceYearPaisa: null,
      memberLimit: 3,
      aiQuotaMonth: 100,
      summary: ["Up to 3 members", "100 AI entries per month", "6-month history"],
    },
    {
      id: "plus",
      name: "Poribar Plus",
      families: 231,
      priceMonthPaisa: 9900,
      priceYearPaisa: 99900,
      memberLimit: 8,
      aiQuotaMonth: 1000,
      summary: [
        "Up to 8 members, unlimited history",
        "1,000 AI entries per month",
        "Voice and receipt entry, Ask",
        "Export",
      ],
    },
    {
      id: "probashi",
      name: "Probashi",
      families: 60,
      priceMonthPaisa: 14900,
      priceYearPaisa: null,
      memberLimit: 8,
      aiQuotaMonth: 1000,
      summary: ["Everything in Plus", "Remittance planner", "Multi-currency (SAR, AED, MYR, GBP to BDT)"],
    },
  ],
  aiCost: { perFamilyPaisa: 1140, goalPaisa: 1500 },
  nearQuota: [
    { familyId: "f1", familyName: "মিয়া পরিবার", plan: "free", used: 100, limit: 100, resetsOn: "2026-12-01" },
    { familyId: "f2", familyName: "রহিম পরিবার", plan: "free", used: 93, limit: 100, resetsOn: "2026-12-01" },
    { familyId: "f3", familyName: "হোসেন পরিবার", plan: "plus", used: 760, limit: 1000, resetsOn: "2026-12-01" },
  ],
};
