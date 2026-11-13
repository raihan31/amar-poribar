"use client";

import { useState } from "react";
import { type BreakdownRow, type MonthSummary } from "@amar-poribar/shared";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import { delta, monthLabel, shiftMonth } from "@/lib/format/month";

function Delta({ now, before, moreIsBad }: { now: number; before: number; moreIsBad: boolean }) {
  const t = useT();
  const { num } = useFormat();
  const d = delta(now, before);
  if (!d || d.dir === "flat") return <span className="delta">{t("vsLastMonth")}: –</span>;
  const bad = (d.dir === "up") === moreIsBad;
  return (
    <span className={`delta ${bad ? "up" : "down"}`}>
      {t("vsLastMonth")}: {num(d.pct)}% {d.dir === "up" ? t("more") : t("less")}
    </span>
  );
}

/** Month totals, comparison with last month, and breakdowns by category, member and account. */
export function MonthSummaryCard({ summary, onMonth }: { summary: MonthSummary; onMonth: (m: string) => void }) {
  const t = useT();
  const { money: fmtMoney, tag } = useFormat();
  const [view, setView] = useState<"category" | "member" | "account">("category");
  const rows: BreakdownRow[] =
    view === "category"
      ? summary.byCategory.map((c) => ({ id: c.categoryId, name: c.name, totalPaisa: c.totalPaisa }))
      : view === "member"
        ? summary.byMember
        : summary.byAccount;
  const max = Math.max(1, ...rows.map((r) => r.totalPaisa));
  const net = summary.incomePaisa - summary.expensePaisa;
  const prevNet = summary.previous.incomePaisa - summary.previous.expensePaisa;
  const money = (p: number) => fmtMoney(p);
  const label = monthLabel(summary.month, tag);

  return (
    <div className="card">
      <div className="month-nav">
        <button
          className="secondary"
          aria-label={t("prevMonth")}
          onClick={() => onMonth(shiftMonth(summary.month, -1))}
        >
          ‹
        </button>
        <strong>{label}</strong>
        <button className="secondary" aria-label={t("nextMonth")} onClick={() => onMonth(shiftMonth(summary.month, 1))}>
          ›
        </button>
      </div>
      <div className="stats">
        <div className="stat">
          <span className="muted">{t("totalIncome")}</span>
          <strong>{money(summary.incomePaisa)}</strong>
          <Delta now={summary.incomePaisa} before={summary.previous.incomePaisa} moreIsBad={false} />
        </div>
        <div className="stat">
          <span className="muted">{t("totalExpense")}</span>
          <strong>{money(summary.expensePaisa)}</strong>
          <Delta now={summary.expensePaisa} before={summary.previous.expensePaisa} moreIsBad />
        </div>
        <div className="stat">
          <span className="muted">{t("netSaving")}</span>
          <strong>{money(net)}</strong>
          <span className="delta">
            {t("vsLastMonth")}: {money(prevNet)}
          </span>
        </div>
      </div>
      <div className="tabs" role="group">
        {(["category", "member", "account"] as const).map((v) => (
          <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
            {t(v === "category" ? "byCategory" : v === "member" ? "byMember" : "byAccount")}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="muted">{t("noData")}</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id ?? "none"} className="bar-row">
              <span className="bar-label">
                <span>{r.name}</span>
                <span>{money(r.totalPaisa)}</span>
              </span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${(r.totalPaisa / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
