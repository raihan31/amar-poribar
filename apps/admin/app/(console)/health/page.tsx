"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";
import { PageTitle } from "@/components/shell/PageTitle";
import { MetricTile } from "@/components/health/MetricTile";
import { BackupCard } from "@/components/health/BackupCard";
import { QueueCard } from "@/components/health/QueueCard";
import { IncidentList } from "@/components/health/IncidentList";
import { dateTimeText, type Health } from "@/components/health/types";

const REFRESH_MS = 60_000;

export default function HealthPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: qk.health(),
    queryFn: () => api<Health>("/admin/v1/health"),
    refetchInterval: REFRESH_MS,
  });
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageTitle
        title="System health"
        actions={data && <span className="muted">Last 30 days · updated {dateTimeText(data.asOf)} (Asia/Dhaka)</span>}
      />
      {isPending && <p role="status">Loading…</p>}
      {isError && !data && <p role="alert">Could not load system health.</p>}
      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {data.tiles.map((t) => (
              <MetricTile key={t.key} tile={t} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            <BackupCard backups={data.backups} />
            <QueueCard {...data.queue} />
          </div>
          <IncidentList incidents={data.incidents} />
        </>
      )}
      <p className="muted" style={{ fontSize: 13 }}>
        🔒 Logs and metrics here contain counts and timings only. No phone numbers, names, notes or message content
        (NFR-12).
      </p>
    </div>
  );
}
