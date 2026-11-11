"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/ui/FilterBar";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { ACTIONS, type AuditFilterValue } from "@/lib/audit/types";

const KEYS = ["staff", "action", "family", "range", "from", "to"] as const;

export function readFilters(sp: { get(k: string): string | null }): AuditFilterValue {
  const r = sp.get("range");
  return {
    staff: sp.get("staff") ?? "",
    action: sp.get("action") ?? "",
    family: sp.get("family") ?? "",
    range: r === "7d" || r === "custom" ? r : "30d",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
  };
}

/** Filters live in the URL; changing one drops the cursor. */
export function AuditFilters({ staffNames }: { staffNames: string[] }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/audit";
  const sp = useSearchParams();
  const v = readFilters(sp ?? new URLSearchParams());

  function set(key: (typeof KEYS)[number], value: string) {
    const next = new URLSearchParams();
    for (const k of KEYS) {
      const cur = k === key ? value : v[k];
      if (cur && !(k === "range" && cur === "30d")) next.set(k, cur);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const staffOptions = [{ value: "", label: "All" }, ...staffNames.map((n) => ({ value: n, label: n }))];

  return (
    <FilterBar label="Audit filters">
      <SelectField
        label="Staff"
        options={staffOptions}
        value={v.staff}
        onChange={(e) => set("staff", e.target.value)}
      />
      <SelectField label="Action" options={ACTIONS} value={v.action} onChange={(e) => set("action", e.target.value)} />
      <TextField label="Family name" value={v.family} onChange={(e) => set("family", e.target.value)} />
      <SelectField
        label="Date"
        value={v.range}
        onChange={(e) => set("range", e.target.value)}
        options={[
          { value: "7d", label: "Last 7 days" },
          { value: "30d", label: "Last 30 days" },
          { value: "custom", label: "Custom range" },
        ]}
      />
      {v.range === "custom" && (
        <>
          <TextField label="From" type="date" value={v.from} onChange={(e) => set("from", e.target.value)} />
          <TextField label="To" type="date" value={v.to} onChange={(e) => set("to", e.target.value)} />
        </>
      )}
    </FilterBar>
  );
}
