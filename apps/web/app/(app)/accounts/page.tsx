"use client";

import "@/styles/ledger.css";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AccountCard, accountBalance } from "@/components/features/ledger/AccountCard";
import { AccountForm, type NewAccount } from "@/components/features/ledger/AccountForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { ROLE_RANK, useFamily } from "@/components/shell/useFamily";
import { Banner } from "@/components/ui/Banner";
import { api } from "@/lib/api/client";
import { useAccounts, useMembers } from "@/lib/api/hooks/useFamilyData";
import { qk } from "@/lib/api/queryKeys";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { Account } from "@/lib/types";

interface MemberLike {
  userId: string;
  name?: string | null;
  displayName?: string | null;
}

/** E1: accounts with balances; owners and admins add and archive (FR-ACC-01..04). */
export default function AccountsPage() {
  const t = useT();
  const { money } = useFormat();
  const qc = useQueryClient();
  const { family, role } = useFamily();
  const canEdit = ROLE_RANK[role] >= ROLE_RANK.admin;
  const base = `/v1/families/${family.id}`;
  const accounts = useAccounts(family.id);
  const members = useMembers(family.id);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const list = (accounts.data ?? []) as unknown as Account[];
  const owners = new Map(
    ((members.data ?? []) as unknown as MemberLike[]).map((m) => [m.userId, m.displayName ?? m.name ?? ""]),
  );
  const total = list.reduce((sum, a) => sum + accountBalance(a), 0);

  async function run(fn: () => Promise<unknown>) {
    setFailed(false);
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: qk.family(family.id).all });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("acc.title")} />
      <main className="ledger-page">
        <p className="muted">{t("acc.sub")}</p>
        <p className="ledger-total">{t("acc.total", { amount: money(total) })}</p>
        {failed && <Banner tone="danger">{t("fam.error")}</Banner>}
        <ul className="ledger-accounts">
          {list.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              ownerName={a.ownerUserId ? (owners.get(a.ownerUserId) ?? null) : null}
              canEdit={canEdit}
              onArchive={(x) =>
                run(() => api(`${base}/accounts/${x.id}`, { method: "PATCH", body: { archived: true } }))
              }
            />
          ))}
        </ul>
        {canEdit && (
          <section>
            <h2>{t("acc.new")}</h2>
            <AccountForm
              busy={busy}
              onSubmit={(a: NewAccount) => run(() => api(`${base}/accounts`, { method: "POST", body: a }))}
            />
          </section>
        )}
      </main>
    </>
  );
}
