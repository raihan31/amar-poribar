"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { qk } from "../queryKeys";

export type FamilyActionName = "plan" | "quota" | "transfer-ownership" | "suspend" | "unsuspend" | "delete";

/** POST /admin/v1/families/:id/:action; on success refreshes the detail and audit queries. */
export function useFamilyAction(familyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { action: FamilyActionName; body: Record<string, unknown> }) =>
      api<Record<string, unknown> | undefined>(`/admin/v1/families/${encodeURIComponent(familyId)}/${v.action}`, {
        method: "POST",
        body: v.body,
        idempotent: true,
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.family(familyId) }),
        qc.invalidateQueries({ queryKey: ["admin", "audit"] }),
      ]);
    },
  });
}
