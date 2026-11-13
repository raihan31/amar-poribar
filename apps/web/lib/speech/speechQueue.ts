/** Serialises spoken utterances (SRS FR-VOICE-04). */

export interface EnqueueOptions {
  interrupt?: boolean;
  lang?: string;
}
export interface SpeechQueue {
  enqueue(text: string, opts?: EnqueueOptions): boolean;
  cancelAll(): void;
  pending(): number;
  subscribe(listener: (speaking: boolean) => void): () => void;
}

export const SPEECH_RATE = 0.9;

const BANGLA = /[ঀ-৿]/;

export function detectLang(text: string): string {
  return BANGLA.test(text) ? "bn-BD" : "en-IN";
}

function hasSynth(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.slice(0, 2).toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

export function createSpeechQueue(): SpeechQueue {
  const queue: { text: string; lang: string }[] = [];
  let current: SpeechSynthesisUtterance | null = null;
  const listeners = new Set<(s: boolean) => void>();
  const notify = () => listeners.forEach((l) => l(current !== null || queue.length > 0));

  const next = () => {
    const item = queue.shift();
    if (!item) {
      current = null;
      notify();
      return;
    }
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = item.lang;
    u.rate = SPEECH_RATE;
    const voice = pickVoice(item.lang);
    if (voice) u.voice = voice;
    const advance = () => {
      if (current === u) next();
    };
    u.onend = advance;
    u.onerror = advance;
    current = u;
    window.speechSynthesis.speak(u);
    notify();
  };

  const cancelAll = () => {
    queue.length = 0;
    const had = current !== null;
    current = null;
    if (hasSynth()) window.speechSynthesis.cancel();
    if (had) notify();
  };

  return {
    enqueue(text, opts = {}) {
      if (!hasSynth()) return false;
      if (opts.interrupt) cancelAll();
      queue.push({ text, lang: opts.lang ?? detectLang(text) });
      if (current === null) next();
      return true;
    },
    cancelAll,
    pending: () => queue.length,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

let shared: SpeechQueue | null = null;
export function getSpeechQueue(): SpeechQueue {
  shared ??= createSpeechQueue();
  return shared;
}
