"use client";

import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DeadlinePill } from "./DeadlinePill";
import { daysLeft, isOverdue, type PrivacyRequest } from "./types";

const KIND = { delete: "Delete account", export: "Export my data" } as const;

function received(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" }).format(
    new Date(iso),
  );
}

export function RequestTable({
  items,
  now,
  canAct = true,
  loading,
  selectedId,
  onSelect,
  onContinue,
}: {
  items: PrivacyRequest[];
  now?: Date;
  canAct?: boolean;
  loading?: boolean;
  selectedId?: string | null;
  /** Opens the detail card. */
  onSelect: (r: PrivacyRequest) => void;
  /** Advances to the next automatable step. */
  onContinue: (r: PrivacyRequest) => void;
}) {
  const columns: Column<PrivacyRequest>[] = [
    {
      key: "id",
      header: "Request",
      cell: (r) => (
        <button
          type="button"
          style={{ all: "unset", cursor: "pointer", textDecoration: "underline" }}
          aria-pressed={selectedId === r.id}
          onClick={() => onSelect(r)}
        >
          {r.id}
        </button>
      ),
    },
    { key: "kind", header: "Type", cell: (r) => KIND[r.kind] },
    { key: "person", header: "Person", cell: (r) => r.personPhoneMasked },
    { key: "family", header: "Family", cell: (r) => r.familyName },
    { key: "received", header: "Received", cell: (r) => received(r.receivedAt) },
    { key: "deadline", header: "Deadline", cell: (r) => <DeadlinePill dueAt={r.dueAt} now={now} /> },
    { key: "step", header: "Step", cell: (r) => r.step },
    {
      key: "action",
      header: "Action",
      cell: (r) => {
        if (!canAct) return null;
        const urgent = isOverdue(r.dueAt, now) || daysLeft(r.dueAt, now) <= 5;
        return (
          <Button variant={urgent ? "primary" : "secondary"} onClick={() => onContinue(r)}>
            {urgent ? "Act now" : "Continue"}
          </Button>
        );
      },
    },
  ];
  return (
    <DataTable
      caption="Privacy requests"
      columns={columns}
      rows={items}
      rowKey={(r) => r.id}
      loading={loading}
      emptyTitle="No requests here"
    />
  );
}
