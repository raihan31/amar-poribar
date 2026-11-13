import { Card } from "@/components/ui/Card";
import { fmtSync, type FamilyDetail } from "./types";

export function UsageCard({ usage }: { usage: FamilyDetail["usage"] }) {
  const rows: [string, string][] = [
    ["Entries this month", String(usage.entries)],
    ["Voice share of entries", `${usage.voiceShare}%`],
    ["Devices signed in", String(usage.devices)],
    ["Last sync", fmtSync(usage.lastSyncAt)],
  ];
  return (
    <Card title="Usage (counts only)">
      {rows.map(([k, v]) => (
        <div className="row" style={{ justifyContent: "space-between", padding: "6px 0" }} key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
      <p className="muted row" style={{ gap: 6 }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Transactions, chat and media are hidden from staff.
      </p>
    </Card>
  );
}
