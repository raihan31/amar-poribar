import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { fmtDay, type StaffAction } from "./types";

export function StaffActionsCard({ familyId, actions }: { familyId: string; actions: StaffAction[] }) {
  return (
    <Card title="Recent staff actions">
      {actions.slice(0, 3).map((a, i) => (
        <div className="row" style={{ gap: 10, padding: "6px 0" }} key={a.id ?? i}>
          <span style={{ flex: 1 }}>{a.reason ? `${a.action} · reason: ${a.reason}` : a.action}</span>
          <span className="muted">
            {a.staffName} · {fmtDay(a.at)}
          </span>
        </div>
      ))}
      <Link href={`/audit?family=${encodeURIComponent(familyId)}`} style={{ fontWeight: 600 }}>
        Open full audit log
      </Link>
    </Card>
  );
}
