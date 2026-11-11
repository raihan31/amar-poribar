import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatWhen, type AuditItem } from "@/lib/audit/types";
import { KindPill } from "./KindPill";

const columns: Column<AuditItem>[] = [
  { key: "at", header: "When", cell: (r) => formatWhen(r.at) },
  { key: "who", header: "Who", cell: (r) => r.staffName },
  { key: "action", header: "Action", cell: (r) => r.action },
  { key: "family", header: "Family", cell: (r) => r.familyName || "—" },
  { key: "reason", header: "Reason", cell: (r) => r.reason || "—" },
  { key: "kind", header: "Kind", cell: (r) => <KindPill kind={r.kind} /> },
];

/** Read-only: there are deliberately no row actions. */
export function AuditTable({ items, loading }: { items: AuditItem[]; loading?: boolean }) {
  return (
    <DataTable
      caption="Audit log"
      columns={columns}
      rows={items}
      rowKey={(r) => String(r.id)}
      loading={loading}
      emptyTitle="No entries match these filters"
    />
  );
}
