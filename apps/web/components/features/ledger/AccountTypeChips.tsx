"use client";

import type { AccountType } from "@amar-poribar/shared";
import { Chip } from "@/components/ui/Chip";
import { useT, type TKey } from "@/lib/i18n/useT";

/** Display order and label key per account type (FR-ACC-01). */
export const ACCOUNT_TYPE_OPTIONS: ReadonlyArray<{ type: AccountType; label: TKey; emoji: string }> = [
  { type: "bkash", label: "acc.type.bkash", emoji: "📲" },
  { type: "cash", label: "acc.type.cash", emoji: "💵" },
  { type: "nagad", label: "acc.type.nagad", emoji: "📱" },
  { type: "rocket", label: "acc.type.rocket", emoji: "🚀" },
  { type: "upay", label: "acc.type.upay", emoji: "💳" },
  { type: "bank", label: "acc.type.bank", emoji: "🏦" },
  { type: "card", label: "acc.type.card", emoji: "💳" },
  { type: "other", label: "acc.type.other", emoji: "👛" },
];

/** Single-select chips for the account type; the chosen one carries a "✓". */
export function AccountTypeChips({ value, onChange }: { value: AccountType; onChange: (t: AccountType) => void }) {
  const t = useT();
  return (
    <div role="group" aria-label={t("acc.typeLabel")} className="ledger-chips">
      {ACCOUNT_TYPE_OPTIONS.map((o) => (
        <Chip key={o.type} selected={o.type === value} onClick={() => onChange(o.type)}>
          {o.type === value && <span aria-hidden="true">✓ </span>}
          {t(o.label)}
        </Chip>
      ))}
    </div>
  );
}
