/** Browser speech recognition wrapper (SRS FR-VOICE-01, FR-VOICE-05). */

export type SpeechErrorCode = "mic_denied" | "no_speech" | "offline" | "unsupported" | "unknown";

export const NO_SPEECH_TIMEOUT_MS = 8000;

interface RecognitionResultEvent {
  results: { [i: number]: { [j: number]: { transcript: string } }; length: number };
}
export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => RecognitionLike;

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function mapRecognitionError(error: string): SpeechErrorCode {
  switch (error) {
    case "not-allowed":
      return "mic_denied";
    case "no-speech":
      return "no_speech";
    case "network":
      return "offline";
    case "service-not-allowed":
      return "unsupported";
    default:
      return "unknown";
  }
}

export interface RecognitionOptions {
  lang: string;
  onText: (text: string) => void;
  onError: (code: SpeechErrorCode) => void;
  onEnd?: () => void;
}
export interface RecognitionHandle {
  stop(): void;
}

/** Starts one single-shot recognition. Returns null (after reporting `unsupported`) when unavailable. */
export function startRecognition(opts: RecognitionOptions): RecognitionHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    opts.onError("unsupported");
    return null;
  }
  const rec = new Ctor();
  rec.lang = opts.lang;
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const finish = () => {
    clear();
    if (!done) {
      done = true;
      opts.onEnd?.();
    }
  };
  const safeStop = () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
  rec.onresult = (e) => {
    clear();
    const text = e.results[0]?.[0]?.transcript?.trim();
    if (text) opts.onText(text);
  };
  rec.onerror = (e) => {
    if (done) return;
    clear();
    opts.onError(mapRecognitionError(e.error));
  };
  rec.onend = finish;
  timer = setTimeout(() => {
    timer = undefined;
    if (done) return;
    opts.onError("no_speech");
    safeStop();
    finish();
  }, NO_SPEECH_TIMEOUT_MS);
  try {
    rec.start();
  } catch {
    finish();
    opts.onError("unknown");
    return null;
  }
  return { stop: safeStop };
}
