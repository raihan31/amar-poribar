import type { Page } from "@playwright/test";

/** Resolves with the elapsed milliseconds until the text is visible (no fixed sleeps). */
export async function waitForText(page: Page, text: string | RegExp, timeout = 5000): Promise<number> {
  const start = Date.now();
  await page.getByText(text).first().waitFor({ state: "visible", timeout });
  return Date.now() - start;
}

/** Records vibration calls into `window.__vibrations`. Call before navigation. */
export async function trackVibrations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __vibrations: unknown[] };
    w.__vibrations = [];
    navigator.vibrate = ((p: unknown) => {
      w.__vibrations.push(p);
      return true;
    }) as Navigator["vibrate"];
  });
}

/** Retries `fn` until it stops throwing or the timeout passes. */
export async function eventually<T>(fn: () => Promise<T> | T, timeoutMs = 5000, stepMs = 100): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (Date.now() > deadline) throw e;
      await new Promise((r) => setTimeout(r, stepMs));
    }
  }
}
