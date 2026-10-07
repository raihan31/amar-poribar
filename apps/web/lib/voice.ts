"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser speech helpers (SRS FR-VOICE-01, FR-VOICE-04).
 * Speech recognition uses the Web Speech API (Chrome/Edge on desktop and Android support bn-BD).
 * Speech output uses speechSynthesis; Bangla voices depend on the device (Android usually has one).
 */

interface RecognitionResultEvent {
  results: { [i: number]: { [j: number]: { transcript: string } }; length: number };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(lang = "bn-BD") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => setSupported(getRecognitionCtor() !== null), []);

  const start = useCallback((onText: (text: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) onText(text);
    };
    rec.onerror = (e) => setError(e.error);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  }, [lang]);

  const stop = useCallback(() => recRef.current?.stop(), []);
  return { supported, listening, error, start, stop };
}

/** Speak text aloud. Returns false when the browser has no speech synthesis. */
export function speak(text: string, lang = "bn-BD"): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9; // a little slower is easier to follow
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
