"use client";

import Link from "next/link";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { BudgetRow } from "@/lib/types";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { BudgetStatus } from "./BudgetStatus";

export interface BudgetCardProps {
  row: BudgetRow;
  /** Who to tell about an exceeded budget (an admin or the owner, never oneself). */
  tell: { id: string; name: string } | null;
  canTell: boolean;
}

/** One budget: name, spent / limit, 14 px bar and status. The border follows the status, the word always shows. */
export function BudgetCard({ row, tell, canTell }: BudgetCardProps) {
  const t = useT();
  const { money, name } = useFormat();
  const label = name(row);
  const percent = row.limitPaisa > 0 ? Math.floor((row.spentPaisa * 100) / row.limitPaisa) : 100;
  const tone = row.level === "exceeded" ? "danger" : row.level === "warning" ? "warn" : "ok";
  return (
    <li className={`bud-card bud-card--${row.level}`}>
      <div className="bud-card-head">
        <span>{label}</span>
        <span>
          {money(row.spentPaisa)} / {money(row.limitPaisa)}
        </span>
      </div>
      <ProgressBar label={label} percent={percent} tone={tone} />
      <div className="bud-card-foot">
        <BudgetStatus row={row} />
        {row.level === "exceeded" && canTell && tell && (
          <Link href={`/buzz?to=${encodeURIComponent(tell.id)}&phrase=budget`} className="bud-buzz">
            {t("bud.buzz", { name: tell.name })}
          </Link>
        )}
      </div>
    </li>
  );
}
