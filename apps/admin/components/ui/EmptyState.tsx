import type { ReactNode } from "react";

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty" role="status" style={{ textAlign: "center", padding: 32 }}>
      <p style={{ fontWeight: 600, margin: 0 }}>{title}</p>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}
