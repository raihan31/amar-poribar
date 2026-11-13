import { useQuery } from "@tanstack/react-query";
import type { MonthlyAiSummary, MonthSummary } from "@amar-poribar/shared";
import { api } from "@/lib/api/client";
import { withMemberLabels } from "@/lib/api/hooks/useFamilyData";
import { qk } from "@/lib/api/queryKeys";
import type { BudgetRow, Member } from "@/lib/types";

export interface PresenceRow {
  userId: string;
  online: boolean;
  lastSeenAt?: string | null;
}

export interface ActivityItem {
  id: string;
  kind: "voice_note" | "expense";
  byName: string;
  durationSec?: number;
  audioUrl?: string;
  amountPaisa?: number;
  text?: string;
  txnId?: string;
}

export function useMonthSummary(familyId: string) {
  return useQuery({
    queryKey: qk.family(familyId).summary(),
    queryFn: () => api<MonthSummary>(`/v1/families/${familyId}/reports/summary`),
  });
}

export function useAiSummary(familyId: string, locale: string) {
  return useQuery({
    queryKey: [...qk.family(familyId).all, "ai-summary", locale],
    queryFn: () => api<MonthlyAiSummary>(`/v1/families/${familyId}/ai/summary?locale=${locale}`),
  });
}

export function useBudgetRows(familyId: string) {
  return useQuery({
    queryKey: qk.family(familyId).budgets(),
    queryFn: async () => (await api<{ budgets: BudgetRow[] }>(`/v1/families/${familyId}/budgets`)).budgets,
  });
}

export function useFamilyMembers(familyId: string) {
  return useQuery({
    queryKey: qk.family(familyId).members(),
    queryFn: () => api<Member[]>(`/v1/families/${familyId}/members`),
    select: withMemberLabels,
  });
}

/** Presence refreshes every 30 s until live updates arrive (T-WEB-31). */
export function usePresence(familyId: string) {
  return useQuery({
    queryKey: qk.family(familyId).presence(),
    queryFn: () => api<PresenceRow[]>(`/v1/families/${familyId}/presence`),
    refetchInterval: 30_000,
  });
}

export function useActivity(familyId: string) {
  return useQuery({
    queryKey: [...qk.family(familyId).all, "activity"],
    queryFn: () => api<ActivityItem[]>(`/v1/families/${familyId}/activity?limit=2`),
  });
}
