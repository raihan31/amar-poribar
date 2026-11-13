"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { fmtDay } from "@/components/family/types";
import { fmtCount, pctOf, PLAN_NAME, type NearQuotaRow } from "./types";

function State({ row }: { row: NearQuotaRow }) {
  const pct = pctOf(row.used, row.limit);
  if (row.used >= row.limit) return <StatusPill kind="risk">Quota reached</StatusPill>;
  if (pct >= 90) return <StatusPill kind="warn">{pct}% used</StatusPill>;
  return <StatusPill kind="ok">On track</StatusPill>;
}

/** Counts only: never what was entered. */
export function NearQuotaTable({ rows, loading }: { rows: NearQuotaRow[]; loading?: boolean }) {
  const columns: Column<NearQuotaRow>[] = [
    { key: "family", header: "Family", cell: (r) => r.familyName },
    { key: "plan", header: "Plan", cell: (r) => PLAN_NAME[r.plan] },
    { key: "used", header: "AI used", cell: (r) => `${fmtCount(r.used)} / ${fmtCount(r.limit)}` },
    { key: "resets", header: "Resets", cell: (r) => fmtDay(r.resetsOn) },
    { key: "state", header: "State", cell: (r) => <State row={r} /> },
    {
      key: "open",
      header: "Open",
      cell: (r) => (
        <Link href={`/families/${r.familyId}`} aria-label={`Open ${r.familyName}`}>
          Open
        </Link>
      ),
    },
  ];
  return (
    <Card title="Families near quota">
      <p className="muted">Counts only. Staff cannot see what was entered.</p>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.familyId}
        caption="Families near quota"
        loading={loading}
        emptyTitle="No family is near its quota"
      />
    </Card>
  );
}
