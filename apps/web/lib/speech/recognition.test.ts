import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapRecognitionError, startRecognition, type SpeechErrorCode } from "./recognition";

class FakeRec {
  static last: FakeRec;
  lang = "";
  continuous = true;
  interimResults = true;
  maxAlternatives = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  constructor() {
    FakeRec.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
    this.onend?.();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRec;
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
});

describe("recognition", () => {
  it("maps not-allowed to mic_denied", () => {
    expect(mapRecognitionError("not-allowed")).toBe("mic_denied");
    expect(mapRecognitionError("no-speech")).toBe("no_speech");
    expect(mapRecognitionError("network")).toBe("offline");
    expect(mapRecognitionError("service-not-allowed")).toBe("unsupported");
    const errors: SpeechErrorCode[] = [];
    startRecognition({ lang: "bn-BD", onText() {}, onError: (c) => errors.push(c) });
    FakeRec.last.onerror?.({ error: "not-allowed" });
    expect(errors).toEqual(["mic_denied"]);
  });

  it("configures single-shot recognition", () => {
    startRecognition({ lang: "bn-BD", onText() {}, onError() {} });
    expect(FakeRec.last.continuous).toBe(false);
    expect(FakeRec.last.interimResults).toBe(false);
    expect(FakeRec.last.started).toBe(true);
  });

  it("times out after 8 s of silence", () => {
    const errors: SpeechErrorCode[] = [];
    startRecognition({ lang: "bn-BD", onText() {}, onError: (c) => errors.push(c) });
    vi.advanceTimersByTime(7999);
    expect(errors).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(errors).toEqual(["no_speech"]);
    expect(FakeRec.last.stopped).toBe(true);
  });

  it("reports unsupported without a constructor", () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    const errors: SpeechErrorCode[] = [];
    expect(startRecognition({ lang: "bn-BD", onText() {}, onError: (c) => errors.push(c) })).toBeNull();
    expect(errors).toEqual(["unsupported"]);
  });
});
