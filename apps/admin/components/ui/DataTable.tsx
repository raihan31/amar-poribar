"use client";

import { useState, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  emptyTitle?: string;
  /** Called with the next sort; when omitted the table only toggles aria-sort. */
  onSort?: (key: string, dir: "ascending" | "descending") => void;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading,
  emptyTitle = "Nothing to show",
  onSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "ascending" | "descending" } | null>(null);

  function toggle(key: string) {
    const dir = sort?.key === key && sort.dir === "ascending" ? "descending" : "ascending";
    setSort({ key, dir });
    onSort?.(key, dir);
  }

  if (!loading && rows.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <div className="table-scroll" data-testid="table-scroll" role="region" aria-label={caption}>
      <table className="dt">
        <caption className="sr-only" style={{ position: "absolute", left: -9999 }}>
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{ textAlign: c.align ?? "left" }}
                aria-sort={c.sortable ? (sort?.key === c.key ? sort.dir : "none") : undefined}
              >
                {c.sortable ? (
                  <button type="button" onClick={() => toggle(c.key)} style={{ all: "unset", cursor: "pointer" }}>
                    {c.header}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? [0, 1, 2].map((i) => (
                <tr key={i} data-testid="skeleton-row" aria-hidden="true">
                  {columns.map((c) => (
                    <td key={c.key}>
                      <span className="skeleton" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align ?? "left" }}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
