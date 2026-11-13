import { useQuery } from "@tanstack/react-query";
import type { TransactionDetail } from "@amar-poribar/shared";
import { api } from "../client";
import { ApiProblem } from "../errors";

/** `GET …/transactions/:id`; a deleted entry answers 410 `transaction_deleted` with `details.restorableUntil`. */
export function useTransaction(familyId: string, txnId: string) {
  return useQuery({
    queryKey: ["family", familyId, "transactions", "one", txnId] as const,
    queryFn: () => api<TransactionDetail>(`/v1/families/${familyId}/transactions/${txnId}`),
    retry: false,
  });
}

/** True when the error is the "deleted, still restorable" answer. */
export function isDeletedProblem(e: unknown): e is ApiProblem {
  return e instanceof ApiProblem && e.status === 410;
}
