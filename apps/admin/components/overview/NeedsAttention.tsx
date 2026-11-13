import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { NeedsAttentionItem } from "./types";

function title(i: NeedsAttentionItem): string {
  switch (i.kind) {
    case "quota_over_90":
      return `${i.count} families used 90%+ of AI quota`;
    case "otp_failures":
      return `OTP delivery failures: ${i.count}% today`;
    case "no_owner":
      return `${i.count} families have no active owner`;
    default:
      return `${i.kind}: ${i.count}`;
  }
}

const LINK_TEXT: Record<string, string> = { otp_failures: "Open" };

export function NeedsAttention({ items }: { items: NeedsAttentionItem[] }) {
  return (
    <Card title="Needs attention">
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((i) => (
          <li
            key={i.kind}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: "12px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{title(i)}</div>
              <div className="muted">{i.detail}</div>
            </div>
            <Link href={i.href} style={{ fontWeight: 600, color: "var(--green-700)" }}>
              {LINK_TEXT[i.kind] ?? "Review"}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
