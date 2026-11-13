"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/ui/FilterBar";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import type { FamilyFilterState } from "@/lib/api/hooks/useFamilies";

export function readFilters(sp: { get(k: string): string | null }): FamilyFilterState {
  const page = Number.parseInt(sp.get("page") ?? "1", 10);
  return {
    q: sp.get("q") ?? "",
    plan: sp.get("plan") ?? "",
    status: sp.get("status") ?? "",
    quota: sp.get("quota") ?? "",
    sort: sp.get("sort") ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Reads filters from the URL and writes patches back; any filter change resets to page 1. */
export function useFilterUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = readFilters(sp);
  function update(patch: Partial<FamilyFilterState>) {
    const next = { ...filters, ...patch };
    if (!("page" in patch)) next.page = 1;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (v === "" || (k === "page" && v === 1)) continue;
      p.set(k, String(v));
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }
  return { filters, update };
}

const PLAN = [
  { value: "", label: "All" },
  { value: "free", label: "Free" },
  { value: "plus", label: "Plus" },
  { value: "probashi", label: "Probashi" },
];
const STATUS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "no_owner", label: "No owner" },
  { value: "dormant", label: "Dormant" },
  { value: "suspended", label: "Suspended" },
];
const QUOTA = [
  { value: "", label: "Any" },
  { value: "over90", label: "Over 90%" },
];

export function FamilyFilters() {
  const { filters, update } = useFilterUrl();
  // null means "not editing": show the URL value.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? filters.q;

  useEffect(() => {
    if (draft === null) return;
    const t = setTimeout(() => {
      if (draft !== filters.q) update({ q: draft });
      setDraft(null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <FilterBar label="Family filters">
      <TextField
        label="Search"
        type="search"
        value={text}
        placeholder="Search by family name or owner phone (last 3 digits shown)"
        onChange={(e) => setDraft(e.target.value)}
        style={{ minWidth: 340 }}
      />
      <SelectField
        label="Plan"
        options={PLAN}
        value={filters.plan}
        onChange={(e) => update({ plan: e.target.value })}
      />
      <SelectField
        label="Status"
        options={STATUS}
        value={filters.status}
        onChange={(e) => update({ status: e.target.value })}
      />
      <SelectField
        label="AI quota"
        options={QUOTA}
        value={filters.quota}
        onChange={(e) => update({ quota: e.target.value })}
      />
    </FilterBar>
  );
}
