"use client";

import { monthLabel, shiftMonth } from "@/lib/format/month";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";

/** ‹ month › with 48 px buttons. */
export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const t = useT();
  const { tag } = useFormat();
  return (
    <div className="txn-month">
      <button
        type="button"
        className="txn-month__btn"
        aria-label={t("prevMonth")}
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        ‹
      </button>
      <strong>{monthLabel(month, tag)}</strong>
      <button
        type="button"
        className="txn-month__btn"
        aria-label={t("nextMonth")}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        ›
      </button>
    </div>
  );
}
