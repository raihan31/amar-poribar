"use client";

import { useState } from "react";
import type { AccountType } from "@amar-poribar/shared";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import { AccountTypeChips } from "./AccountTypeChips";

export interface NewAccount {
  name: string;
  type: AccountType;
  /** Integer paisa. */
  openingBalancePaisa: number;
}

/** "নতুন অ্যাকাউন্ট" form (FR-ACC-01). */
export function AccountForm({ onSubmit, busy = false }: { onSubmit: (a: NewAccount) => void; busy?: boolean }) {
  const t = useT();
  const { locale } = useI18n();
  const [type, setType] = useState<AccountType>("cash");
  const [name, setName] = useState("");
  const [opening, setOpening] = useState(0);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, type, openingBalancePaisa: opening });
    setName("");
    setOpening(0);
  }

  return (
    <form
      className="ledger-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <AccountTypeChips value={type} onChange={setType} />
      <Field label={t("accountName")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <AmountInput label={t("acc.opening")} valuePaisa={opening} onChange={setOpening} lang={locale} />
      <Button type="submit" size="lg" disabled={busy || !name.trim()}>
        {t("acc.add")}
      </Button>
    </form>
  );
}
