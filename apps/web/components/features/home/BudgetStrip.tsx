"use client";

import Link from "next/link";
import { bnPossessive } from "@/lib/home/greeting";
import { useFormat } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import type { BudgetRow } from "@/lib/types";
import { Icon } from "@/components/ui/icons";

/** Amber strip for the first budget at warning or exceeded; hidden otherwise (FR-BUD-06). */
export function BudgetStrip({
  rows,
  tell,
  canTell,
}: {
  rows: BudgetRow[];
  /** Who to buzz: the family admin (name for the label, id for the link). */
  tell: { id: string; name: string } | null;
  canTell: boolean;
}) {
  const t = useT();
  const { num, name } = useFormat();
  const { locale } = useI18n();
  const row = rows.find((r) => r.level === "warning" || r.level === "exceeded");
  if (!row) return null;
  const pct = row.limitPaisa > 0 ? Math.round((row.spentPaisa * 100) / row.limitPaisa) : 100;
  const label = locale === "bn" ? bnPossessive(name(row)) : name(row);
  return (
    <section className="home-budget" role="status">
      <Icon name="warning" size={24} />
      <div className="home-budget-text">
        {row.level === "exceeded"
          ? t("home.budgetOver", { name: label })
          : t("home.budgetUsed", { name: label, pct: num(pct) })}
      </div>
      {canTell && tell && (
        <Link href={`/buzz?to=${encodeURIComponent(tell.id)}&phrase=budget`} className="home-budget-btn">
          {t("home.tellPerson", { name: tell.name })}
        </Link>
      )}
    </section>
  );
}
