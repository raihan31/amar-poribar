export interface NeedsAttentionItem {
  kind: string;
  count: number;
  detail: string;
  href: string;
}

export interface Overview {
  activeFamilies: number;
  activeFamiliesDelta: number;
  avgMembers: number;
  aiCostPerFamilyPaisa: number;
  openPrivacyRequests: number;
  oldestPrivacyRequestDays: number;
  needsAttention: NeedsAttentionItem[];
  newFamiliesByWeek: { weekStart: string; count: number }[];
  asOf: string;
}

/** Fixture reproducing the AdminOverview design numbers. */
export const overviewFixture: Overview = {
  activeFamilies: 1284,
  activeFamiliesDelta: 86,
  avgMembers: 3.1,
  aiCostPerFamilyPaisa: 1140,
  openPrivacyRequests: 3,
  oldestPrivacyRequestDays: 12,
  needsAttention: [
    {
      kind: "quota_over_90",
      count: 7,
      detail: "Most are on the Free plan (100 entries)",
      href: "/families?quota=over90",
    },
    { kind: "otp_failures", count: 4.2, detail: "Normal range is under 1.5%. Check the SMS gateway.", href: "/health" },
    {
      kind: "no_owner",
      count: 2,
      detail: "Owner account deleted; members are waiting",
      href: "/families?status=no_owner",
    },
  ],
  newFamiliesByWeek: [
    { weekStart: "2026-09-16", count: 40 },
    { weekStart: "2026-09-23", count: 48 },
    { weekStart: "2026-09-30", count: 52 },
    { weekStart: "2026-10-07", count: 61 },
    { weekStart: "2026-10-14", count: 58 },
    { weekStart: "2026-10-21", count: 72 },
    { weekStart: "2026-10-28", count: 80 },
    { weekStart: "2026-11-04", count: 92 },
  ],
  asOf: "2026-11-11T04:00:00Z",
};
