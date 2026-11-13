"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/useT";
import { useSpeak } from "@/lib/speech/useSpeak";

/** Giant amber "শুনুন" button: speaks `speechText`, reads "থামুন" while speaking (FR-VOICE-04). */
export function ListenButton({ speechText, autoSpeak = false }: { speechText: string; autoSpeak?: boolean }) {
  const t = useT();
  const { speak, stop, speaking } = useSpeak();
  const auto = useRef(false);

  // Simple mode: read the summary once when the page opens.
  useEffect(() => {
    if (!autoSpeak || auto.current || !speechText) return;
    auto.current = true;
    speak(speechText, { interrupt: true });
  }, [autoSpeak, speechText, speak]);

  // Leaving the page silences the voice.
  useEffect(() => stop, [stop]);

  return (
    <button
      type="button"
      className="sum-listen"
      onClick={() => (speaking ? stop() : speak(speechText, { interrupt: true }))}
    >
      <Icon name="speaker" size={46} />
      {speaking ? t("stop") : t("speak")}
    </button>
  );
}
