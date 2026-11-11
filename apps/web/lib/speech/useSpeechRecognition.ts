"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRecognitionCtor, startRecognition, type RecognitionHandle, type SpeechErrorCode } from "./recognition";

export function useSpeechRecognition(lang = "bn-BD") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechErrorCode | null>(null);
  const handle = useRef<RecognitionHandle | null>(null);

  useEffect(() => setSupported(getRecognitionCtor() !== null), []);
  useEffect(() => () => handle.current?.stop(), []);

  const start = useCallback(
    (onText: (text: string) => void) => {
      setError(null);
      setListening(true);
      handle.current = startRecognition({
        lang,
        onText,
        onError: setError,
        onEnd: () => setListening(false),
      });
      if (!handle.current) setListening(false);
    },
    [lang],
  );

  const stop = useCallback(() => handle.current?.stop(), []);
  return { supported, listening, error, start, stop };
}
