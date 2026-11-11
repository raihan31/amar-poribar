import type { ReactNode } from "react";

export type PillKind = "ok" | "warn" | "risk" | "neutral" | "info";

const ICON: Record<PillKind, string | null> = { ok: "✓", warn: "⚠", risk: "■", neutral: null, info: "ⓘ" };

/** Never colour alone: always an icon (except neutral) plus text. */
export function StatusPill({ kind, children }: { kind: PillKind; children: ReactNode }) {
  const icon = ICON[kind];
  return (
    <span className={`ui-pill ui-pill--${kind}`}>
      {icon && (
        <span aria-hidden="true" data-testid="pill-icon">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </span>
  );
}
