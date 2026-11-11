"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import type { FamilyRow } from "@/lib/api/hooks/useFamilies";
import { FamilyStatusPill } from "./FamilyStatusPill";

const PLAN: Record<string, string> = { free: "Free", plus: "Plus", probashi: "Probashi" };

export function lastActiveLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "Never";
  const day = (d: Date) => Math.floor(d.getTime() / 86_400_000);
  const days = Math.max(0, day(now) - day(new Date(iso)));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

const columns: Column<FamilyRow>[] = [
  { key: "name", header: "Family", sortable: true, cell: (r) => r.name },
  {
    key: "owner",
    header: "Owner",
    cell: (r) => (r.status === "no_owner" || !r.ownerPhoneMasked ? "— none —" : r.ownerPhoneMasked),
  },
  { key: "members", header: "Members", sortable: true, cell: (r) => r.members },
  { key: "plan", header: "Plan", cell: (r) => PLAN[r.plan] ?? r.plan },
  {
    key: "aiUsed",
    header: "AI used",
    sortable: true,
    cell: (r) => `${r.aiUsed.toLocaleString("en-US")} / ${r.aiLimit.toLocaleString("en-US")}`,
  },
  { key: "lastActive", header: "Last active", sortable: true, cell: (r) => lastActiveLabel(r.lastActiveAt) },
  { key: "status", header: "Status", cell: (r) => <FamilyStatusPill status={r.status} /> },
  {
    key: "open",
    header: "",
    cell: (r) => (
      <Link href={`/families/${r.id}`} aria-label={`Open ${r.name}`}>
        Open
      </Link>
    ),
  },
];

export interface FamilyTableProps {
  rows: FamilyRow[];
  loading?: boolean;
  onSort?: (key: string, dir: "ascending" | "descending") => void;
  onClear?: () => void;
}

export function FamilyTable({ rows, loading, onSort, onClear }: FamilyTableProps) {
  if (!loading && rows.length === 0) {
    return (
      <div className="empty" role="status" style={{ textAlign: "center", padding: 32 }}>
        <p style={{ fontWeight: 600, margin: 0 }}>No families match these filters.</p>
        {onClear && <Button onClick={onClear}>Clear filters</Button>}
      </div>
    );
  }
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      caption="Families"
      loading={loading}
      onSort={onSort}
    />
  );
}
