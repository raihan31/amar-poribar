import { afterEach, describe, expect, it, vi } from "vitest";
import { checkBanglaSupport } from "./availability";

const w = window as unknown as { speechSynthesis: unknown };
const original = w.speechSynthesis;
function setSynth(voices: { lang: string }[]) {
  w.speechSynthesis = { getVoices: () => voices, addEventListener() {}, removeEventListener() {} };
}
afterEach(() => {
  w.speechSynthesis = original;
  Reflect.deleteProperty(window, "SpeechRecognition");
  vi.useRealTimers();
});

describe("checkBanglaSupport", () => {
  it("banglaVoice false when no bn voice", async () => {
    setSynth([{ lang: "en-US" }]);
    const r = await checkBanglaSupport();
    expect(r.synthesis).toBe(true);
    expect(r.banglaVoice).toBe(false);
  });
  it("banglaVoice true with bn-BD voice", async () => {
    setSynth([{ lang: "bn-BD" }]);
    expect((await checkBanglaSupport()).banglaVoice).toBe(true);
  });
  it("resolves after 2 s when voices never load", async () => {
    vi.useFakeTimers();
    setSynth([]);
    const p = checkBanglaSupport();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual({ recognition: false, synthesis: true, banglaVoice: false });
  });
  it("no synthesis at all", async () => {
    w.speechSynthesis = undefined;
    expect(await checkBanglaSupport()).toEqual({ recognition: false, synthesis: false, banglaVoice: false });
  });
});
