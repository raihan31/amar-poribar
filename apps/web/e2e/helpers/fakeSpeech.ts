import type { Page } from "@playwright/test";

/**
 * Injects a fake `SpeechRecognition` that answers each `start()` with the next scripted transcript,
 * and records every `speechSynthesis.speak` text into `window.__spoken`. Call before navigation.
 */
export async function installFakeSpeech(page: Page, transcripts: string[]): Promise<void> {
  await page.addInitScript((script: string[]) => {
    const w = window as unknown as Record<string, unknown>;
    w.__spoken = [] as string[];
    let i = 0;
    class FakeRecognition {
      lang = "bn-BD";
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onstart: (() => void) | null = null;
      start() {
        const text = script[Math.min(i++, script.length - 1)] ?? "";
        setTimeout(() => {
          this.onstart?.();
          const alt = { transcript: text, confidence: 0.95 };
          const res = Object.assign([alt], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: Object.assign([res], { length: 1 }) });
          this.onend?.();
        }, 50);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      (w.__spoken as string[]).push(u.text);
    };
  }, transcripts);
}
