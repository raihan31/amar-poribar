"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { Account } from "@/lib/types";
import { ACCOUNT_TYPE_OPTIONS } from "./AccountTypeChips";

const LONG_PRESS_MS = 600;

/** Balance shown for an account: the server's running balance, else the opening balance (FR-ACC-03). */
export const accountBalance = (a: Account) => a.balancePaisa ?? a.openingBalancePaisa ?? 0;

/** One account row: type tile, name, owner line and balance. Editors archive via long press or the button. */
export function AccountCard(props: {
  account: Account;
  ownerName: string | null;
  canEdit: boolean;
  onArchive: (a: Account) => void;
}) {
  const { account, ownerName, canEdit, onArchive } = props;
  const t = useT();
  const { money } = useFormat();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emoji = ACCOUNT_TYPE_OPTIONS.find((o) => o.type === account.type)?.emoji ?? "👛";

  const start = () => {
    if (!canEdit) return;
    timer.current = setTimeout(() => onArchive(account), LONG_PRESS_MS);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <li
      className="ledger-account"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
    >
      <span className="ledger-account__icon" aria-hidden="true">
        {emoji}
      </span>
      <span className="ledger-account__main">
        <strong>{account.name}</strong>
        <span className="muted">
          {account.ownerUserId ? t("acc.owner", { name: ownerName ?? "" }) : t("acc.shared")}
        </span>
      </span>
      <span className="ledger-account__balance">{money(accountBalance(account))}</span>
      {canEdit && (
        <Button variant="secondary" aria-label={`${t("archive")}: ${account.name}`} onClick={() => onArchive(account)}>
          {t("archive")}
        </Button>
      )}
    </li>
  );
}
