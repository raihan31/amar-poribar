"use client";

import { useState } from "react";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { SelectField } from "@/components/ui/SelectField";
import type { FamilyPlan } from "@/lib/api/hooks/useFamilies";
import { useFamilyAction } from "@/lib/api/hooks/useFamilyAction";
import { PLAN_LABEL } from "./PlanQuotaCard";

const OPTIONS = (Object.keys(PLAN_LABEL) as FamilyPlan[]).map((p) => ({ value: p, label: PLAN_LABEL[p] }));

export function ChangePlanDialog({
  open,
  familyId,
  current,
  onDone,
  onCancel,
  onError,
}: {
  open: boolean;
  familyId: string;
  current: FamilyPlan;
  onDone: () => void;
  onCancel: () => void;
  onError?: (e: unknown) => void;
}) {
  const [plan, setPlan] = useState<string>(current);
  const action = useFamilyAction(familyId);
  return (
    <ReasonDialog
      open={open}
      title="Change plan"
      confirmLabel="Change plan"
      extra={<SelectField label="Plan" options={OPTIONS} value={plan} onChange={(e) => setPlan(e.target.value)} />}
      onCancel={onCancel}
      onConfirm={(reason) => action.mutate({ action: "plan", body: { plan, reason } }, { onSuccess: onDone, onError })}
    />
  );
}
