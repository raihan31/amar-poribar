"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { qk } from "../queryKeys";

export type FamilyStatus = "active" | "no_owner" | "dormant" | "suspended";
export type FamilyPlan = "free" | "plus" | "probashi";

export interface FamilyRow {
  id: string;
  name: string;
  ownerPhoneMasked: string | null;
  members: number;
  plan: FamilyPlan;
  aiUsed: number;
  aiLimit: number;
  lastActiveAt: string | null;
  status: FamilyStatus;
}

export interface FamiliesPage {
  items: FamilyRow[];
  total: number;
  nextCursor: string | null;
  pageCount?: number;
}

export interface FamilyFilterState {
  q: string;
  plan: string;
  status: string;
  quota: string;
  sort: string;
  page: number;
}

export const PAGE_SIZE = 25;

/** Query string for the list/export endpoints; empty filters are omitted. */
export function familiesQuery(f: Partial<FamilyFilterState>, extra: Record<string, string> = {}): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of ["q", "plan", "status", "quota", "sort"] as const) {
    const v = f[k];
    if (v) p.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p;
}

export function useFamilies(filters: FamilyFilterState, cursor?: string | null) {
  const extra: Record<string, string> = { limit: String(PAGE_SIZE) };
  if (cursor) extra.cursor = cursor;
  else if (filters.page > 1) extra.page = String(filters.page);
  const qs = familiesQuery(filters, extra).toString();
  return useQuery({
    queryKey: qk.families({ ...filters, cursor: cursor ?? undefined }),
    queryFn: () => api<FamiliesPage>(`/admin/v1/families?${qs}`),
    placeholderData: keepPreviousData,
  });
}
