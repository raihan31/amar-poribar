"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";

/** Sum of `unread` over `GET /v1/families/:id/conversations`; 0 while loading or on error. */
export function useUnreadCount(familyId: string): number {
  const { data } = useQuery({
    queryKey: qk.family(familyId).conversations(),
    queryFn: () => api<Array<{ unread?: number }>>(`/v1/families/${familyId}/conversations`),
    refetchInterval: 60_000,
  });
  return Array.isArray(data) ? data.reduce((sum, c) => sum + (c.unread ?? 0), 0) : 0;
}
