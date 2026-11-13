/** Spoken output helpers (SRS FR-VOICE-04). */
import { amountInWords } from "@amar-poribar/shared";
import { getSpeechQueue } from "./speechQueue";

/** Amount in Bangla words, for reading money aloud. */
export function spokenAmount(paisa: number): string {
  return amountInWords(paisa, "bn");
}

/** Speak text; returns false when the browser has no speech synthesis. */
export function speak(text: string, opts: { interrupt?: boolean; lang?: string } = {}): boolean {
  return getSpeechQueue().enqueue(text, opts);
}

export function stopSpeaking(): void {
  getSpeechQueue().cancelAll();
}

/** In Simple mode (`ap_simple=1` cookie) results are read aloud automatically. */
export function isSimpleMode(): boolean {
  return typeof document !== "undefined" && /(?:^|;\s*)ap_simple=1(?:;|$)/.test(document.cookie);
}

export function autoSpeak(text: string): boolean {
  return isSimpleMode() ? speak(text, { interrupt: true }) : false;
}
