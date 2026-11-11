import type { Page } from "@playwright/test";

/** Stubs `getUserMedia` and `MediaRecorder` for specs that do not need real WebRTC. Call before navigation. */
export async function installFakeMedia(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const track = { kind: "audio", stop() {}, enabled: true } as unknown as MediaStreamTrack;
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
      getVideoTracks: () => [],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => stream, enumerateDevices: async () => [] },
    });
    class FakeRecorder {
      state: "inactive" | "recording" = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      static isTypeSupported() {
        return true;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    (window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeRecorder;
  });
}
