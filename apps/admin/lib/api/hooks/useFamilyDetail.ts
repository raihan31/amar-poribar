"use client";

import { useQuery } from "@tanstack/react-query";
import type { FamilyDetail } from "@/components/family/types";
import { api } from "../client";
import { qk } from "../queryKeys";

export function useFamilyDetail(id: string) {
  return useQuery({
    queryKey: qk.family(id),
    queryFn: () => api<FamilyDetail>(`/admin/v1/families/${encodeURIComponent(id)}`),
  });
}
