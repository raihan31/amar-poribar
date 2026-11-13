"use client";

import "@/styles/entry.css";
import { useRouter } from "next/navigation";
import { SmsPaste } from "@/components/features/entry/SmsPaste";
import { BackHeader } from "@/components/shell/BackHeader";
import { useFamily } from "@/components/shell/useFamily";
import { useAccounts, useCategories } from "@/lib/api/hooks/useFamilyData";
import { useT } from "@/lib/i18n/useT";
import type { Account, Category } from "@/lib/types";

const NONE: never[] = [];

/** A5 paste an SMS (FR-AI-02, FR-TXN-04). Viewers get the read-only message instead. */
export default function SmsEntryPage() {
  const t = useT();
  const router = useRouter();
  const { family, role } = useFamily();
  const cats = useCategories(family.id);
  const accts = useAccounts(family.id);

  return (
    <>
      <BackHeader title={t("sms.title")} />
      <main className="entry">
        {role === "viewer" ? (
          <p>{t("role.readOnly")}</p>
        ) : (
          <SmsPaste
            familyId={family.id}
            categories={(cats.data ?? NONE) as unknown as Category[]}
            accounts={(accts.data ?? NONE) as unknown as Account[]}
            onSaved={() => router.push("/")}
            onDiscard={() => router.back()}
          />
        )}
      </main>
    </>
  );
}
