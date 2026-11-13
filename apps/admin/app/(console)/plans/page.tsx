"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageTitle } from "@/components/shell/PageTitle";
import { Toast } from "@/components/ui/Toast";
import { AiCostCard } from "@/components/plans/AiCostCard";
import { NearQuotaTable } from "@/components/plans/NearQuotaTable";
import { PlanCard } from "@/components/plans/PlanCard";
import { QuotaRuleCard } from "@/components/plans/QuotaRuleCard";
import type { PlanChange, PlansResponse } from "@/components/plans/types";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";
import { useStaff } from "@/lib/auth/useStaff";

export default function PlansPage() {
  const staff = useStaff();
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: qk.plans(),
    queryFn: () => api<PlansResponse>("/admin/v1/plans"),
  });
  const save = useMutation({
    mutationFn: (v: { id: string; change: PlanChange; reason: string }) =>
      api(`/admin/v1/plans/${encodeURIComponent(v.id)}`, { method: "PUT", body: { ...v.change, reason: v.reason } }),
    onSuccess: () => {
      setToast("Saved. Applies from the next billing month.");
      return qc.invalidateQueries({ queryKey: qk.plans() });
    },
    onError: () => setToast("Could not save. Try again."),
  });

  // Owner and Support may change the quota; only the Owner may change price and member limit.
  const canEditQuota = staff.can("change_plan");
  const canEditPricing = staff.role === "owner";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageTitle title="Plans & AI quota" subtitle="Changes apply from the next billing month" />
      {isPending && <p role="status">Loading…</p>}
      {isError && !data && <p role="alert">Could not load plans.</p>}
      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {data.plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                canEditQuota={canEditQuota}
                canEditPricing={canEditPricing}
                busy={save.isPending}
                onSave={(change, reason) => save.mutate({ id: p.id, change, reason })}
              />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            <AiCostCard cost={data.aiCost} />
            <QuotaRuleCard />
          </div>
          <NearQuotaTable rows={data.nearQuota} />
        </>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
