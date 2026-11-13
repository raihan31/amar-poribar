"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icons";
import type { DraftView } from "@/lib/entry/quickParse";
import { useDraftLabels } from "@/lib/entry/useDraftLabels";
import { useFormat } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import { speak } from "@/lib/speech/synthesis";

const ANSWER_SIZE = 104;

export interface DraftReadBackProps {
  transcript: string;
  view: DraftView;
  onYes: () => void;
  onNo: () => void;
  /** Where "change amount or category" goes (the typed form with this draft). */
  changeHref: string;
  saving?: boolean;
}

/** A3: hear before you save. Speaks the draft once on entry (always again in Simple mode when it changes). */
export function DraftReadBack({ transcript, view, onYes, onNo, changeHref, saving = false }: DraftReadBackProps) {
  const t = useT();
  const { simple } = useI18n();
  const { name } = useFormat();
  const labels = useDraftLabels();
  const { draft, category } = view;
  const sentence = labels.sentence(draft, category);

  // Normal mode: once per mount. Simple mode: whenever the sentence changes.
  const spoken = useRef<string | null>(null);
  const once = useRef(false);
  useEffect(() => {
    if (simple ? spoken.current === sentence : once.current) return;
    spoken.current = sentence;
    once.current = true;
    speak(sentence, { interrupt: true });
  }, [sentence, simple]);

  return (
    <div className="entry-readback">
      <p className="entry-said">
        <Icon name="mic" size={20} /> {t("entry.youSaid")}
      </p>
      <blockquote className="entry-transcript">&ldquo;{transcript}&rdquo;</blockquote>

      <section className="entry-card" aria-label={t("entry.titleVoice")}>
        <div className="entry-card-head">
          <span className="entry-tile" aria-hidden="true">
            {category?.icon ?? <Icon name="list" size={32} />}
          </span>
          <div>
            <div className="entry-cat">{category ? name(category) : t("category.pick")}</div>
            <div className="entry-meta">{labels.meta(draft)}</div>
          </div>
        </div>
        <div className="entry-amount">{labels.amount(draft)}</div>
        <div className="entry-words">{labels.words(draft)}</div>
        <button type="button" className="entry-listen" onClick={() => speak(sentence, { interrupt: true })}>
          <Icon name="speaker" size={26} /> {t("entry.listenAgain")}
        </button>
      </section>

      <p className="entry-ask">{t("entry.isOk")}</p>
      <div className="entry-spacer" />
      <div className="entry-answers">
        <button
          type="button"
          className="entry-no"
          onClick={onNo}
          style={{ minHeight: ANSWER_SIZE, minWidth: ANSWER_SIZE }}
        >
          <Icon name="close" size={28} />
          {t("entry.no")}
        </button>
        <button
          type="button"
          className="entry-yes"
          onClick={onYes}
          disabled={saving}
          style={{ minHeight: ANSWER_SIZE, minWidth: ANSWER_SIZE }}
        >
          <Icon name="check" size={32} />
          {t("entry.keep")}
        </button>
      </div>
      <Link href={changeHref} className="entry-change">
        {t("entry.change")}
      </Link>
    </div>
  );
}
