"use client";

import Link from "next/link";
import type { MonthSummary } from "@amar-poribar/shared";
import { monthIn } from "@/lib/home/greeting";
import { useFormat } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import { useSpeak } from "@/lib/speech/useSpeak";
import { Icon } from "@/components/ui/icons";

/** Green month card: spending, change from last month in words, Listen button (FR-HOME-01, FR-REP-01). */
export function MonthCard({ summary, speechText }: { summary: MonthSummary; speechText?: string }) {
  const t = useT();
  const { money } = useFormat();
  const { locale } = useI18n();
  const { speak } = useSpeak();
  const diff = summary.expensePaisa - summary.previous.expensePaisa;
  const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const change =
    dir === "up"
      ? t("home.moreThanLast", { amount: money(diff) })
      : dir === "down"
        ? t("home.lessThanLast", { amount: money(-diff) })
        : t("home.sameAsLast");

  return (
    <section className="home-month">
      <div className="home-month-text">
        <div className="home-month-title">{t("home.monthSpent", { month: monthIn(summary.month, locale) })}</div>
        <div className="home-month-amount">{money(summary.expensePaisa)}</div>
        <div className={`home-delta home-delta--${dir}`}>{change}</div>
        <Link href="/summary" className="home-month-link">
          {t("home.monthDetails")}
        </Link>
      </div>
      <button
        type="button"
        className="home-listen"
        disabled={!speechText}
        onClick={() => speechText && speak(speechText, { interrupt: true })}
      >
        <Icon name="speaker" size={24} />
        {t("home.listen")}
      </button>
    </section>
  );
}
