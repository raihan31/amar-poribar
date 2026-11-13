"use client";

import "@/styles/entry.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TransactionForm } from "@/components/features/entry/TransactionForm";
import { BackHeader } from "@/components/shell/BackHeader";
import { RoleGate } from "@/components/shell/RoleGate";
import { ROLE_RANK, useFamily } from "@/components/shell/useFamily";
import { useAccounts, useCategories, useMembers } from "@/lib/api/hooks/useFamilyData";
import { prefillFromSearch } from "@/lib/entry/prefill";
import { useT } from "@/lib/i18n/useT";
import type { Account, Category, Member } from "@/lib/types";

const NONE: never[] = [];
const TOAST_MS = 900;

/** D4 add expense by hand (FR-TXN-01, -05, -09). Prefills from `?draft=` and `?category=`. */
export default function AddEntryPage() {
  const t = useT();
  const router = useRouter();
  const { family, role, me } = useFamily();
  const cats = useCategories(family.id);
  const accts = useAccounts(family.id);
  const mems = useMembers(family.id);
  const [saved, setSaved] = useState(false);
  const ready = cats.data && accts.data && mems.data;

  const categories = (cats.data ?? NONE) as unknown as Category[];
  const accounts = (accts.data ?? NONE) as unknown as Account[];
  const members = (mems.data ?? NONE) as unknown as Member[];

  function done() {
    setSaved(true);
    setTimeout(() => router.push("/"), TOAST_MS);
  }

  return (
    <>
      <BackHeader title={t("entry.form.title")} />
      {/* RoleGate takes a family role, not an ARIA role. */}
      {/* eslint-disable-next-line jsx-a11y/aria-role */}
      <RoleGate role="member">
        {saved && (
          <div className="entry-toast" role="status">
            {t("entry.saved")}
          </div>
        )}
        {ready && (
          <TransactionForm
            familyId={family.id}
            meId={me?.id}
            canPickMember={ROLE_RANK[role] >= ROLE_RANK.admin}
            categories={categories}
            accounts={accounts}
            members={members}
            defaults={prefillFromSearch(window.location.search, categories, accounts, me?.id)}
            onSaved={done}
          />
        )}
      </RoleGate>
    </>
  );
}
