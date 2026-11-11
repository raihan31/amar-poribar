"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";
import { useUnreadCount } from "@/lib/hooks/useUnreadCount";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { BudgetRow } from "@/lib/types";
import { FamilyCard } from "@/components/features/family/FamilyCard";
import { BackHeader } from "@/components/shell/BackHeader";
import { useFamily } from "@/components/shell/useFamily";

/** F2: pick which family is open. Only the open family's badges are known without extra requests. */
export default function SwitchFamilyPage() {
  const t = useT();
  const { num } = useFormat();
  const { family, families } = useFamily();
  const unread = useUnreadCount(family.id);
  const budgets = useQuery({
    queryKey: qk.family(family.id).budgets(),
    queryFn: () => api<{ budgets: BudgetRow[] }>(`/v1/families/${family.id}/budgets`),
  });
  const alerts = (budgets.data?.budgets ?? []).filter((b) => b.level !== "ok").length;
  const count = families.length === 2 ? t("sw.countTwo") : t("sw.countN", { n: num(families.length) });

  return (
    <main className="switch-page">
      <BackHeader title={t("sw.title")} />
      <p className="family-sub">{t("sw.sub", { count })}</p>
      <div className="family-cards">
        {families.map((f) => {
          const active = f.id === family.id;
          return (
            <FamilyCard
              key={f.id}
              family={f}
              active={active}
              unread={active ? unread : 0}
              budgetAlerts={active ? alerts : 0}
            />
          );
        })}
      </div>
      <div className="family-actions">
        <Link href="/family/new" className="ui-btn ui-btn--primary" style={{ minHeight: 56 }}>
          {t("sw.new")}
        </Link>
        <Link href="/join" className="ui-btn ui-btn--secondary" style={{ minHeight: 56 }}>
          {t("sw.join")}
        </Link>
      </div>
      <p className="family-note">{t("sw.note")}</p>
    </main>
  );
}
