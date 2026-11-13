"use client";

import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { BudgetRow } from "@/lib/types";
import { Icon } from "@/components/ui/icons";

/** The warning threshold the server uses; shown in the word so it matches the alert. */
export const WARN_PERCENT = 80;

/** Status as icon + word, never colour alone (FR-BUD-06). */
export function BudgetStatus({ row }: { row: Pick<BudgetRow, "level" | "limitPaisa" | "spentPaisa"> }) {
  const t = useT();
  const { money, num } = useFormat();
  const { level } = row;
  const text =
    level === "exceeded"
      ? t("bud.over", { amount: money(Math.max(0, row.spentPaisa - row.limitPaisa)) })
      : level === "warning"
        ? t("bud.warn", { pct: num(WARN_PERCENT) })
        : t("bud.ok");
  return (
    <span className={`bud-status bud-status--${level}`}>
      <Icon name={level === "exceeded" ? "alert" : level === "warning" ? "warning" : "check"} size={22} />
      <span>{text}</span>
    </span>
  );
}
