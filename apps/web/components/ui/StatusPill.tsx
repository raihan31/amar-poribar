import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export type StatusLevel = "ok" | "warn" | "danger" | "info";

const ICON: Record<StatusLevel, IconName> = { ok: "check", warn: "warning", danger: "close", info: "info" };

/** Never colour alone: always icon + word + colour class. */
export function StatusPill({ level, children }: { level: StatusLevel; children: ReactNode }) {
  return (
    <span className={`ui-pill ui-pill--${level}`}>
      <Icon name={ICON[level]} size={18} />
      <span>{children}</span>
    </span>
  );
}
