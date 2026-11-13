"use client";

import { useT } from "@/lib/i18n/useT";

/** Two starter questions as 52 px chips (B5). */
export function SuggestedQuestions({ onPick, disabled }: { onPick: (q: string) => void; disabled?: boolean }) {
  const t = useT();
  const questions = [t("ask.q1"), t("ask.q2")];
  return (
    <section>
      <h2 className="ask-suggested-title">{t("ask.suggested")}</h2>
      <div className="ask-chips">
        {questions.map((q) => (
          <button key={q} type="button" className="ask-chip" disabled={disabled} onClick={() => onPick(q)}>
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}
