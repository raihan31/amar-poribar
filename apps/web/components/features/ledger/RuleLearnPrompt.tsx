"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import { useSpeak } from "@/lib/speech/useSpeak";

/** D7 trigger: the category moved off "other" (or empty) to a real one and the note is a short merchant-like name. */
export function shouldOfferRule(
  from: { key: string } | null | undefined,
  to: { id: string; key: string } | null | undefined,
  note: string | null | undefined,
): boolean {
  if (!to || to.key === "other") return false;
  if (from && from.key !== "other") return false;
  const n = (note ?? "").trim();
  return n.length >= 2 && n.length <= 40 && !/\d{3,}/.test(n) && n.split(/\s+/).length <= 3;
}

export interface RuleLearnPromptProps {
  open: boolean;
  familyId: string;
  /** The merchant text, e.g. the note. */
  pattern: string;
  fromName: string;
  to: { id: string; name: string };
  onClose: () => void;
}

/** D7 sheet: "from now on always put this merchant under that category?" Yes saves a rule; No does nothing. */
export function RuleLearnPrompt({ open, familyId, pattern, fromName, to, onClose }: RuleLearnPromptProps) {
  const t = useT();
  const { locale } = useI18n();
  const { speak } = useSpeak();
  const [failed, setFailed] = useState(false);
  const last = to.name.codePointAt(to.name.length - 1) ?? 0;
  // Bangla locative: বাজার -> বাজারে (add the e-kar after a consonant); otherwise "খাতে".
  const toIn =
    locale === "bn" && last >= 0x0995 && last <= 0x09b9
      ? `${to.name}${String.fromCodePoint(0x09c7)}`
      : t("rule.in", { name: to.name });
  const question = t("rule.ask", { pattern, toIn });

  async function yes() {
    setFailed(false);
    try {
      await api(`/v1/families/${familyId}/merchant-rules`, { body: { pattern, categoryId: to.id } });
      onClose();
    } catch {
      setFailed(true);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("rule.changed", { from: fromName, to: to.name })}
      closeLabel={t("txn.closeDialog")}
    >
      <p className="txn-rule__q">{question}</p>
      <Button variant="secondary" onClick={() => speak(question, { interrupt: true })}>
        <Icon name="speaker" size={24} /> {t("rule.listen")}
      </Button>
      {failed && <p role="alert">{t("txn.failed")}</p>}
      <div className="ledger-actions">
        <Button size="xl" variant="danger" onClick={onClose}>
          {t("rule.no")}
        </Button>
        <Button size="xl" onClick={yes}>
          {t("rule.yes")}
        </Button>
      </div>
    </Sheet>
  );
}
