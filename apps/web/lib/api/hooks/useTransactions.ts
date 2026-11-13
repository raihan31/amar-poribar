import { useInfiniteQuery } from "@tanstack/react-query";
import type { TransactionPage } from "@amar-poribar/shared";
import { api } from "../client";
import { qk } from "../queryKeys";

export const PAGE_SIZE = 50;

export interface TxnListFilters {
  month: string;
  memberId?: string | undefined;
  accountId?: string | undefined;
  categoryId?: string | undefined;
}

/** Cursor-paged list for one month (FR-TXN-02); pages keep the server's stable order. */
export function useTransactions(familyId: string, filters: TxnListFilters, enabled = true) {
  return useInfiniteQuery({
    enabled,
    queryKey: qk.family(familyId).transactions({ ...filters, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ month: filters.month, limit: String(PAGE_SIZE) });
      if (filters.memberId) q.set("memberId", filters.memberId);
      if (filters.accountId) q.set("accountId", filters.accountId);
      if (filters.categoryId) q.set("categoryId", filters.categoryId);
      if (pageParam) q.set("cursor", pageParam);
      return api<TransactionPage>(`/v1/families/${familyId}/transactions?${q}`);
    },
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}
