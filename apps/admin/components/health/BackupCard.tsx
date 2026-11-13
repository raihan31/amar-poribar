import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { dateTimeText, dayText, type HealthBackups } from "./types";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #EFE6D3",
      }}
    >
      <span className="muted">{label}</span>
      <span>{children}</span>
    </div>
  );
}

/** NFR-08: daily backup, 14 days kept, weekly automated restore test. */
export function BackupCard({ backups: b }: { backups: HealthBackups }) {
  return (
    <Card title="Backups (NFR-08)">
      <Row label="Last daily backup">{dateTimeText(b.lastAt)} ✓ Done</Row>
      <Row label="Backups kept">{b.keptDays} days</Row>
      <Row label="Last restore test">
        {dayText(b.lastRestoreAt)} {b.lastRestoreOk ? "✓ Passed" : "⚠ Failed"}
      </Row>
      <Row label="Next restore test">
        <b>weekly (automated)</b> · due {dayText(b.nextRestoreAt)}
      </Row>
    </Card>
  );
}
