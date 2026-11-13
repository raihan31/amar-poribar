"use client";

import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { ROLE_LABEL, normalizeRole } from "@/lib/permissions";
import type { StaffAction, StaffMember } from "./types";

const TZ = "Asia/Dhaka";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

function lastSignIn(iso: string | null, now: Date): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(d);
  if (dayKey(d) === dayKey(now)) return `Today, ${time}`;
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86_400_000))) return `Yesterday, ${time}`;
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TZ }).format(d);
  return `${date}, ${time}`;
}

export function StaffTable({
  items,
  selfId,
  canAct = true,
  now = new Date(),
  loading,
  onAction,
}: {
  items: StaffMember[];
  /** Id of the signed-in staff member; their row never has actions. */
  selfId?: string | null;
  canAct?: boolean;
  now?: Date;
  loading?: boolean;
  onAction: (a: StaffAction, m: StaffMember) => void;
}) {
  const columns: Column<StaffMember>[] = [
    { key: "name", header: "Name", cell: (m) => m.name },
    { key: "email", header: "Email", cell: (m) => m.email },
    { key: "role", header: "Role", cell: (m) => ROLE_LABEL[normalizeRole(m.role)] },
    {
      key: "totp",
      header: "2FA",
      cell: (m) =>
        m.totpEnabled ? <StatusPill kind="ok">Enabled</StatusPill> : <StatusPill kind="warn">Not set</StatusPill>,
    },
    { key: "last", header: "Last sign-in", cell: (m) => lastSignIn(m.lastSignInAt, now) },
    {
      key: "status",
      header: "Status",
      cell: (m) =>
        m.status === "active" ? (
          <StatusPill kind="ok">Active</StatusPill>
        ) : m.status === "locked_2fa" ? (
          <StatusPill kind="warn">Locked until 2FA</StatusPill>
        ) : (
          <StatusPill kind="neutral">Disabled</StatusPill>
        ),
    },
  ];
  if (canAct) {
    columns.push({
      key: "actions",
      header: "Actions",
      cell: (m) => {
        if (m.id === selfId) return null;
        return (
          <div className="row" style={{ gap: 8 }}>
            <Button onClick={() => onAction("change_role", m)}>Change role</Button>
            {m.status === "locked_2fa" && <Button onClick={() => onAction("remind", m)}>Send reminder</Button>}
            {m.status !== "disabled" && (
              <Button variant="danger" onClick={() => onAction("disable", m)}>
                Disable
              </Button>
            )}
            {m.totpEnabled && <Button onClick={() => onAction("reset_totp", m)}>Reset 2FA</Button>}
          </div>
        );
      },
    });
  }
  return (
    <DataTable
      caption="Staff accounts"
      columns={columns}
      rows={items}
      rowKey={(m) => m.id}
      loading={loading}
      emptyTitle="No staff yet"
    />
  );
}
