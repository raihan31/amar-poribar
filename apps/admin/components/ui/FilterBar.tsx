import type { ReactNode } from "react";

export function FilterBar({ label = "Filters", children }: { label?: string; children: ReactNode }) {
  return (
    <form
      role="search"
      aria-label={label}
      className="row"
      style={{ flexWrap: "wrap", alignItems: "flex-end" }}
      onSubmit={(e) => e.preventDefault()}
    >
      {children}
    </form>
  );
}
