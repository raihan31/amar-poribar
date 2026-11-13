"use client";

import { Chip } from "@/components/ui/Chip";
import { useT } from "@/lib/i18n/useT";

export interface ChipOption {
  id: string;
  label: string;
}

export interface FilterChipsProps {
  members: ChipOption[];
  accounts: ChipOption[];
  memberId?: string | undefined;
  accountId?: string | undefined;
  onMember: (id: string | undefined) => void;
  onAccount: (id: string | undefined) => void;
}

/** "সবাই", one chip per member, then accounts; single-select inside each group. */
export function FilterChips({ members, accounts, memberId, accountId, onMember, onAccount }: FilterChipsProps) {
  const t = useT();
  return (
    <div className="txn-chips" role="group" aria-label={t("txnl.filters")}>
      <Chip selected={!memberId} onClick={() => onMember(undefined)}>
        {t("txnl.everyone")}
      </Chip>
      {members.map((m) => (
        <Chip key={m.id} selected={memberId === m.id} onClick={() => onMember(memberId === m.id ? undefined : m.id)}>
          {m.label}
        </Chip>
      ))}
      {accounts.map((a) => (
        <Chip key={a.id} selected={accountId === a.id} onClick={() => onAccount(accountId === a.id ? undefined : a.id)}>
          {a.label}
        </Chip>
      ))}
    </div>
  );
}
