import { StatusPill, type PillKind } from "@/components/ui/StatusPill";
import type { AuditKind } from "@/lib/audit/types";

const MAP: Record<AuditKind, { kind: PillKind; text: string }> = {
  risky: { kind: "risk", text: "Risky" },
  privacy: { kind: "warn", text: "Privacy" },
  read: { kind: "neutral", text: "Read" },
  change: { kind: "neutral", text: "Change" },
  signin: { kind: "neutral", text: "Sign-in" },
  security: { kind: "warn", text: "Security" },
};

export function KindPill({ kind }: { kind: AuditKind }) {
  const m = MAP[kind];
  return <StatusPill kind={m.kind}>{m.text}</StatusPill>;
}
