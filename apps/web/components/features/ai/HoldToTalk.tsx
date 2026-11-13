"use client";

import type { KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icons";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import { useSpeechRecognition } from "@/lib/speech/useSpeechRecognition";

/** 104 px amber mic with a halo: hold it, speak, let go (FR-VOICE-08). Renders nothing when speech is unsupported. */
export function HoldToTalk({ onText, disabled = false }: { onText: (text: string) => void; disabled?: boolean }) {
  const t = useT();
  const { locale } = useI18n();
  const { supported, listening, error, start, stop } = useSpeechRecognition(locale === "bn" ? "bn-BD" : "en-US");

  if (!supported) return null;

  const begin = () => {
    if (!disabled && !listening) start(onText);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      begin();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") stop();
  };

  return (
    <div className="ask-talk">
      <button
        type="button"
        className="ask-mic"
        data-listening={listening || undefined}
        aria-label={t("ask.mic")}
        disabled={disabled}
        onPointerDown={begin}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        <Icon name="mic" size={52} />
      </button>
      <div className="ask-hold">{listening ? t("listening") : t("ask.hold")}</div>
      {error && error !== "unsupported" && (
        <p role="status" className="ask-mic-error">
          {t("ask.micError")}
        </p>
      )}
    </div>
  );
}
