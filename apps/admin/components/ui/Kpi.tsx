import type { ReactNode } from "react";

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="kpi">
      <div className="muted">{label}</div>
      <div className="kpi__value">{value}</div>
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}
