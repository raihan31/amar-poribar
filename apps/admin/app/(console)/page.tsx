"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";
import { PageTitle } from "@/components/shell/PageTitle";
import { KpiRow } from "@/components/overview/KpiRow";
import { NeedsAttention } from "@/components/overview/NeedsAttention";
import { NewFamiliesChart } from "@/components/overview/NewFamiliesChart";
import { PrivacyNote } from "@/components/overview/PrivacyNote";
import type { Overview } from "@/components/overview/types";

function asOfText(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export default function OverviewPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: qk.overview(),
    queryFn: () => api<Overview>("/admin/v1/overview"),
  });
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageTitle
        title="Overview"
        actions={data && <span className="muted">Last 30 days · data as of {asOfText(data.asOf)} (Asia/Dhaka)</span>}
      />
      {isPending && <p role="status">Loading…</p>}
      {isError && <p role="alert">Could not load the overview.</p>}
      {data && (
        <>
          <KpiRow {...data} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            <NeedsAttention items={data.needsAttention} />
            <NewFamiliesChart weeks={data.newFamiliesByWeek} />
          </div>
          <PrivacyNote />
        </>
      )}
    </div>
  );
}
