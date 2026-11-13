import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  hint?: string;
  /** One next step, usually a Button. */
  children?: ReactNode;
}

export function EmptyState({ icon = "info", title, hint, children }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <Icon name={icon} size={40} />
      <p>
        <strong>{title}</strong>
      </p>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  );
}
