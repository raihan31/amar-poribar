import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSpeechQueue } from "./speechQueue";

interface U {
  text: string;
  lang: string;
  rate: number;
  voice: { lang: string } | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
let spoken: U[] = [];
let cancelled = 0;
const voices = [{ lang: "en-US" }, { lang: "bn-BD" }, { lang: "en-IN" }];

const w = window as unknown as { speechSynthesis: unknown };
const original = w.speechSynthesis;
afterEach(() => {
  w.speechSynthesis = original;
});

beforeEach(() => {
  spoken = [];
  cancelled = 0;
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    lang = "";
    rate = 1;
    voice = null;
    onend = null;
    onerror = null;
    constructor(public text: string) {}
  };
  w.speechSynthesis = {
    getVoices: () => voices,
    speak: (u: U) => spoken.push(u),
    cancel: () => {
      cancelled++;
    },
  };
});

describe("speechQueue", () => {
  it("queues in order and cancels", () => {
    const q = createSpeechQueue();
    q.enqueue("এক");
    q.enqueue("দুই");
    expect(spoken.map((u) => u.text)).toEqual(["এক"]);
    spoken[0]!.onend?.();
    expect(spoken.map((u) => u.text)).toEqual(["এক", "দুই"]);
    q.enqueue("তিন");
    q.cancelAll();
    expect(cancelled).toBe(1);
    expect(q.pending()).toBe(0);
    spoken[1]!.onend?.();
    expect(spoken).toHaveLength(2);
  });
  it("uses Bangla voice at rate 0.9 and en-IN for English", () => {
    const q = createSpeechQueue();
    q.enqueue("টাকা");
    expect(spoken[0]!.rate).toBe(0.9);
    expect(spoken[0]!.lang).toBe("bn-BD");
    expect(spoken[0]!.voice).toEqual({ lang: "bn-BD" });
    spoken[0]!.onend?.();
    q.enqueue("Total spent");
    expect(spoken[1]!.lang).toBe("en-IN");
    expect(spoken[1]!.voice).toEqual({ lang: "en-IN" });
  });
  it("interrupt replaces the queue", () => {
    const q = createSpeechQueue();
    q.enqueue("এক");
    q.enqueue("দুই");
    q.enqueue("তিন", { interrupt: true });
    expect(spoken.map((u) => u.text)).toEqual(["এক", "তিন"]);
  });
});
