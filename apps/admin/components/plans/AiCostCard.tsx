import { Card } from "@/components/ui/Card";
import { fmtTaka } from "@/components/family/types";
import { pctOf, type AiCost } from "./types";

/** NFR-13: AI cost per active family against the goal. Warns above 90% of the goal. */
export function AiCostCard({ cost }: { cost: AiCost }) {
  const pct = pctOf(cost.perFamilyPaisa, cost.goalPaisa);
  const warn = pct > 90;
  return (
    <Card title="AI cost per active family">
      <p style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>{fmtTaka(cost.perFamilyPaisa)}</p>
      <span className="muted">this month</span>
      <div style={{ height: 12, borderRadius: 6, background: "#EADFC9", margin: "10px 0 6px" }}>
        <div
          role="progressbar"
          aria-label="Share of the AI cost goal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, pct)}
          data-tone={warn ? "amber" : "normal"}
          style={{
            width: `${Math.min(100, pct)}%`,
            height: 12,
            borderRadius: 6,
            background: warn ? "#F2A33A" : "#14451A",
          }}
        />
      </div>
      <div>
        {pct}% of the {fmtTaka(cost.goalPaisa)} goal (NFR-13) · {warn ? "⚠ Close to goal" : "✓ Within goal"}
      </div>
      <p className="muted">Template fallback is used when quota runs out, so cost stops at the limit.</p>
    </Card>
  );
}
