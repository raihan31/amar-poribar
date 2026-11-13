"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useT } from "@/lib/i18n/useT";

export type EntryType = "expense" | "income" | "transfer";

/** খরচ / আয় / স্থানান্তর. */
export function TypeSegment({ value, onChange }: { value: EntryType; onChange: (v: EntryType) => void }) {
  const t = useT();
  return (
    <SegmentedControl<EntryType>
      label={t("entry.form.type")}
      value={value}
      onChange={onChange}
      options={[
        { value: "expense", label: t("entry.type.expense") },
        { value: "income", label: t("entry.type.income") },
        { value: "transfer", label: t("entry.type.transfer") },
      ]}
    />
  );
}
