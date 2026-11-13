import type { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="kpi">
      {title && <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>{title}</h2>}
      {children}
    </section>
  );
}
