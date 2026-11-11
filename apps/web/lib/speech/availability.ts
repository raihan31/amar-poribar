/** Detects which speech features this browser offers (SRS FR-VOICE-07, screen D8). */
import { getRecognitionCtor } from "./recognition";

export interface BanglaSupport {
  recognition: boolean;
  synthesis: boolean;
  banglaVoice: boolean;
}

export const VOICES_TIMEOUT_MS = 2000;

export function hasSynthesis(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

/** Resolves with the voice list, waiting for `voiceschanged` for at most 2 s. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!hasSynthesis()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      synth.removeEventListener("voiceschanged", finish);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(finish, VOICES_TIMEOUT_MS);
    synth.addEventListener("voiceschanged", finish);
  });
}

export async function checkBanglaSupport(): Promise<BanglaSupport> {
  const recognition = getRecognitionCtor() !== null;
  const synthesis = hasSynthesis();
  const voices = await loadVoices();
  const banglaVoice = voices.some((v) => v.lang.toLowerCase().startsWith("bn"));
  return { recognition, synthesis, banglaVoice };
}
