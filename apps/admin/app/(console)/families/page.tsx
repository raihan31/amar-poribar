"use client";

import { Suspense, useState } from "react";
import { PageTitle } from "@/components/shell/PageTitle";
import { FamilyFilters, useFilterUrl } from "@/components/families/FamilyFilters";
import { FamilyTable } from "@/components/families/FamilyTable";
import { Pagination } from "@/components/ui/Pagination";
import { PAGE_SIZE, familiesQuery, useFamilies } from "@/lib/api/hooks/useFamilies";

const fmt = (n: number) => n.toLocaleString("en-US");

function FamiliesView() {
  const { filters, update } = useFilterUrl();
  // Cursor per page index, learned as the user pages forward.
  const [cursors, setCursors] = useState<Record<string, string>>({});
  const key = (page: number) => JSON.stringify({ ...filters, page });
  const { data, isLoading } = useFamilies(filters, cursors[key(filters.page)]);

  const total = data?.total ?? 0;
  const first = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const last = (filters.page - 1) * PAGE_SIZE + (data?.items.length ?? 0);
  const exportHref = `/api/proxy/admin/v1/families?${familiesQuery(filters, { format: "csv" })}`;

  return (
    <div>
      <PageTitle
        title={`Families · ${fmt(total)} total`}
        actions={
          <a className="ui-btn ui-btn--secondary" href={exportHref} download>
            Export list (CSV)
          </a>
        }
      />
      <FamilyFilters />
      <FamilyTable
        rows={data?.items ?? []}
        loading={isLoading}
        onSort={(k, dir) => update({ sort: dir === "descending" ? `-${k}` : k })}
        onClear={() => update({ q: "", plan: "", status: "", quota: "", sort: "" })}
      />
      <p className="muted">
        Showing {fmt(first)}–{fmt(last)} of {fmt(total)} · only counts and status, no transaction data
      </p>
      <Pagination
        page={filters.page}
        pageSize={PAGE_SIZE}
        total={data?.pageCount ? data.pageCount * PAGE_SIZE : total}
        onPage={(p) => {
          if (p === filters.page + 1 && data?.nextCursor) {
            setCursors((c) => ({ ...c, [key(p)]: data.nextCursor as string }));
          }
          update({ page: p });
        }}
      />
    </div>
  );
}

export default function FamiliesPage() {
  return (
    <Suspense>
      <FamiliesView />
    </Suspense>
  );
}
