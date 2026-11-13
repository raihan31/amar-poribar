"use client";

import "@/styles/ai.css";
import { AskThread } from "@/components/features/ai/AskThread";
import { useFamily } from "@/components/shell/useFamily";
import { useT } from "@/lib/i18n/useT";

/** B5: ask the family's records a question, by voice or text (FR-AI-10, FR-VOICE-08). */
export default function AskPage() {
  const t = useT();
  const { family } = useFamily();
  return (
    <main className="ask-page">
      <h1 className="ask-title">{t("ask.title")}</h1>
      <p className="ask-sub">{t("ask.sub")}</p>
      <AskThread familyId={family.id} />
    </main>
  );
}
