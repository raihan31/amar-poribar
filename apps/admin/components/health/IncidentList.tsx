import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { shortStamp, type HealthIncident } from "./types";

export function IncidentList({ incidents }: { incidents: HealthIncident[] }) {
  return (
    <Card title="Recent incidents">
      {incidents.length === 0 && <p className="muted">No incidents in the last 30 days.</p>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {incidents.map((i) => (
          <li
            key={`${i.startedAt}-${i.title}`}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: "1px solid #EFE6D3",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{i.title}</div>
              <div className="muted">
                {shortStamp(i.startedAt)} · {i.note}
              </div>
            </div>
            <StatusPill kind={i.state === "watching" ? "warn" : "ok"}>
              {i.state === "watching" ? "Watching" : "Resolved"}
            </StatusPill>
          </li>
        ))}
      </ul>
    </Card>
  );
}
