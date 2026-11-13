"use client";

import "@/styles/ai.css";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";
import type { MonthlyAiSummary } from "@amar-poribar/shared";
import { amountInWords } from "@amar-poribar/shared";
import { currentMonth, monthLabel } from "@/lib/format/month";
import { firstAmountPaisa } from "@/lib/format/amounts";
import { useFormat } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import { ListenButton } from "@/components/features/ai/ListenButton";
import { SummaryCard } from "@/components/features/ai/SummaryCard";
import { useFamily } from "@/components/shell/useFamily";
import { Banner } from "@/components/ui/Banner";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";

/** B2: the month in plain words, with a big "Listen" button (FR-AI-11, FR-VOICE-04, -05). */
export default function SummaryPage() {
  const t = useT();
  const { tag } = useFormat();
  const { locale, simple } = useI18n();
  const { family } = useFamily();
  const month = currentMonth();
  const summary = useQuery({
    queryKey: [...qk.family(family.id).all, "ai-summary", month, locale],
    queryFn: () => api<MonthlyAiSummary>(`/v1/families/${family.id}/ai/summary?month=${month}&locale=${locale}`),
  });
  const data = summary.data;
  const paisa = data ? firstAmountPaisa(data.text) : null;

  return (
    <main className="sum-page">
      <div className="sum-month">{monthLabel(month, tag)}</div>
      <h1 className="sum-title">{t("sum.title")}</h1>
      {summary.isPending && <Spinner label={t("common.loading")} />}
      {summary.isError && <Banner tone="danger">{t("sum.failed")}</Banner>}
      {data && (
        <>
          <SummaryCard text={data.text} />
          <p className="sum-note">
            <Icon name="info" size={20} />
            {t("sum.note")}
          </p>
          <div className="sum-spacer" />
          <ListenButton speechText={data.speechText} autoSpeak={simple} />
          {paisa !== null && <p className="sum-helper">{t("sum.helper", { words: amountInWords(paisa, locale) })}</p>}
        </>
      )}
    </main>
  );
}
