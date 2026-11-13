import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { FamilyPlan } from "@/lib/api/hooks/useFamilies";
import { fmtDay, fmtTaka, type FamilyDetail } from "./types";

export const PLAN_LABEL: Record<FamilyPlan, string> = { free: "Free", plus: "Plus", probashi: "Probashi" };

export function PlanQuotaCard({
  plan,
  ai,
  canChange,
  readOnly,
  onChangePlan,
  onAddQuota,
}: {
  plan: FamilyPlan;
  ai: FamilyDetail["ai"];
  canChange: boolean;
  readOnly?: boolean;
  onChangePlan: () => void;
  onAddQuota: () => void;
}) {
  const pct = ai.limit > 0 ? Math.min(100, Math.floor((ai.used * 100) / ai.limit)) : 0;
  const amber = ai.limit > 0 && ai.used * 100 >= ai.limit * 90;
  return (
    <Card title="Plan & AI quota">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span>Plan</span>
        <b>{PLAN_LABEL[plan]}</b>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span>AI entries this month</span>
        <b>
          {ai.used} / {ai.limit}
        </b>
      </div>
      <div style={{ height: 12, borderRadius: 6, background: "#EADFC9", margin: "6px 0 4px" }}>
        <div
          role="progressbar"
          aria-label="AI entries used"
          aria-valuemin={0}
          aria-valuemax={ai.limit}
          aria-valuenow={ai.used}
          data-tone={amber ? "amber" : "normal"}
          style={{ width: `${pct}%`, height: 12, borderRadius: 6, background: amber ? "#F2A33A" : "#14451A" }}
        />
      </div>
      <div className="muted">
        Resets on {fmtDay(ai.resetsOn)} · cost this month: {fmtTaka(ai.costPaisa)}
      </div>
      {canChange && (
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <Button onClick={onChangePlan}>Change plan</Button>
          <Button onClick={onAddQuota}>Add 50 entries</Button>
        </div>
      )}
      {readOnly && <p className="muted">You have read-only access.</p>}
    </Card>
  );
}
