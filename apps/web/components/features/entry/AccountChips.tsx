"use client";

import { Chip } from "@/components/ui/Chip";
import { useT } from "@/lib/i18n/useT";
import type { Account } from "@/lib/types";

/** One chip per account; the chosen one carries a "✓". */
export function AccountChips({
  accounts,
  value,
  onChange,
  label,
}: {
  accounts: Account[];
  value: string | null | undefined;
  onChange: (id: string) => void;
  label: string;
}) {
  const t = useT();
  return (
    <div role="group" aria-label={label} className="entry-chips">
      {accounts.length === 0 && <span className="entry-hint">{t("entry.form.noAccount")}</span>}
      {accounts.map((a) => (
        <Chip key={a.id} selected={a.id === value} onClick={() => onChange(a.id)}>
          {a.id === value && <span aria-hidden="true">✓ </span>}
          {a.name}
        </Chip>
      ))}
    </div>
  );
}
