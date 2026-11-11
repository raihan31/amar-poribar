import { Kpi } from "@/components/ui/Kpi";

const GOAL_MEMBERS = 2.5;
const GOAL_COST_PAISA = 1500;
const AMBER_DAYS = 10;

/** Integer paisa to "৳ 11.4" without floats. */
export function formatTakaPaisa(paisa: number): string {
  const whole = Math.trunc(paisa / 100);
  const rest = paisa % 100;
  if (rest === 0) return `৳ ${whole}`;
  const frac = String(rest).padStart(2, "0").replace(/0$/, "");
  return `৳ ${whole}.${frac}`;
}

function goal(text: string, met: boolean) {
  return `${met ? "✓" : "⚠"} ${text} (${met ? "met" : "not met"})`;
}

export interface KpiRowProps {
  activeFamilies: number;
  activeFamiliesDelta: number;
  avgMembers: number;
  aiCostPerFamilyPaisa: number;
  openPrivacyRequests: number;
  oldestPrivacyRequestDays: number;
}

export function KpiRow(p: KpiRowProps) {
  const delta = p.activeFamiliesDelta;
  const amber = p.oldestPrivacyRequestDays >= AMBER_DAYS;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
      <Kpi
        label="Active families"
        value={p.activeFamilies.toLocaleString("en-US")}
        hint={`${delta >= 0 ? "+" : "−"}${Math.abs(delta)} vs previous 30 days`}
      />
      <Kpi
        label="Avg. members per family"
        value={p.avgMembers.toFixed(1)}
        hint={goal(`Goal: ${GOAL_MEMBERS} or more`, p.avgMembers >= GOAL_MEMBERS)}
      />
      <Kpi
        label="AI cost per active family"
        value={formatTakaPaisa(p.aiCostPerFamilyPaisa)}
        hint={goal("Goal: ৳ 15 or less", p.aiCostPerFamilyPaisa <= GOAL_COST_PAISA)}
      />
      <div className="kpi">
        <div className="muted">Open privacy requests</div>
        <div className="kpi__value">{p.openPrivacyRequests}</div>
        <div
          data-testid="oldest-request"
          className={amber ? undefined : "muted"}
          style={amber ? { color: "#9a2a00", fontWeight: 600 } : undefined}
        >
          {amber ? "⚠ " : ""}Oldest: {p.oldestPrivacyRequestDays} days of 30
        </div>
      </div>
    </div>
  );
}
