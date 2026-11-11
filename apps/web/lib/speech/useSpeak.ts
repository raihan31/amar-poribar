"use client";

import { useCallback, useEffect, useState } from "react";
import { getSpeechQueue } from "./speechQueue";

export function useSpeak() {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => getSpeechQueue().subscribe(setSpeaking), []);
  const speak = useCallback(
    (text: string, opts: { interrupt?: boolean; lang?: string } = {}) => getSpeechQueue().enqueue(text, opts),
    [],
  );
  const stop = useCallback(() => getSpeechQueue().cancelAll(), []);
  return { speak, stop, speaking };
}
