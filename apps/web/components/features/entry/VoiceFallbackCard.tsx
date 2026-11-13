"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/useT";
import { checkBanglaSupport, type BanglaSupport } from "@/lib/speech/availability";

export const BANGLA_VOICE_HELP_URL = "https://support.google.com/";

/** D8: shown when this browser cannot recognise Bangla or has no Bangla voice (FR-VOICE-07). */
export function VoiceFallbackCard({ onText }: { onText: (text: string) => void }) {
  const t = useT();
  const [support, setSupport] = useState<BanglaSupport | null>(null);
  const [text, setText] = useState("");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void checkBanglaSupport().then((s) => live && setSupport(s));
    return () => {
      live = false;
    };
  }, []);

  if (!support || (support.recognition && support.banglaVoice)) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (v) onText(v);
  }

  return (
    <section className="entry-fallback" aria-labelledby="entry-fb-title">
      <h2 id="entry-fb-title" className="entry-fb-title">
        {t("entry.fb.title")}
      </h2>
      <p className="entry-fb-lead">{t("entry.fb.noVoice")}</p>
      <p>{t("entry.fb.noWorry")}</p>
      <a className="entry-fb-install" href={BANGLA_VOICE_HELP_URL} target="_blank" rel="noopener noreferrer">
        <strong>{t("entry.fb.install")}</strong>
        <small>{t("entry.fb.installHint")}</small>
      </a>
      <button type="button" className="entry-fb-type" onClick={() => field.current?.focus()}>
        {t("entry.fb.typeNow")}
      </button>
      <form onSubmit={submit}>
        <input
          ref={field}
          className="entry-fb-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("entry.fb.placeholder")}
          aria-label={t("entry.fb.typeNow")}
        />
      </form>
      <div className="entry-fb-shortcuts">
        <Link href="/add/sms" className="entry-fb-short">
          {t("entry.fb.sms")}
        </Link>
        <Link href="/add/receipt" className="entry-fb-short">
          <Icon name="camera" size={22} /> {t("entry.fb.receipt")}
        </Link>
      </div>
      {!support.synthesis && <p className="entry-fb-note">{t("entry.fb.noSynth")}</p>}
    </section>
  );
}
