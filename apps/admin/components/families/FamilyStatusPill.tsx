import { StatusPill, type PillKind } from "@/components/ui/StatusPill";
import type { FamilyStatus } from "@/lib/api/hooks/useFamilies";

const MAP: Record<FamilyStatus, { kind: PillKind; label: string }> = {
  active: { kind: "ok", label: "Active" },
  no_owner: { kind: "warn", label: "No owner" },
  dormant: { kind: "neutral", label: "Dormant" },
  suspended: { kind: "risk", label: "Suspended" },
};

export function FamilyStatusPill({ status }: { status: FamilyStatus }) {
  const m = MAP[status];
  return <StatusPill kind={m.kind}>{m.label}</StatusPill>;
}
