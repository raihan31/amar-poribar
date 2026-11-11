"use client";

import { type MonthlyAiSummary } from "@amar-poribar/shared";
import { useT } from "@/lib/i18n/useT";
import { useSpeak } from "@/lib/speech/useSpeak";

/** Monthly summary in plain words, with a button to hear it (FR-AI-11, FR-VOICE-04). */
export function SpokenSummary({ summary }: { summary: MonthlyAiSummary }) {
  const t = useT();
  const { speak, stop, speaking } = useSpeak();
  function toggle() {
    if (speaking) stop();
    else speak(summary.speechText, { lang: summary.locale === "bn" ? "bn-BD" : "en-IN", interrupt: true });
  }
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{t("monthlySummary")}</strong>
        <button className="secondary" onClick={toggle}>
          {speaking ? `⏹ ${t("stop")}` : `🔊 ${t("speak")}`}
        </button>
      </div>
      <p className="summary-text">{summary.text}</p>
    </div>
  );
}
