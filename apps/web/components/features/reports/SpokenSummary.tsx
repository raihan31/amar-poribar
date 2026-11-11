"use client";

import { useState } from "react";
import { type MonthlyAiSummary } from "@amar-poribar/shared";
import { useT } from "@/lib/i18n/useT";
import { speak, stopSpeaking } from "@/lib/voice";

/** Monthly summary in plain words, with a button to hear it (FR-AI-11, FR-VOICE-04). */
export function SpokenSummary({ summary }: { summary: MonthlyAiSummary }) {
  const t = useT();
  const [speaking, setSpeaking] = useState(false);
  function toggle() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(speak(summary.speechText, summary.locale === "bn" ? "bn-BD" : "en-IN"));
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
