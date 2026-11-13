import { expect, type Page } from "@playwright/test";

/** 2026-11-11T10:00:00+06:00: the clock every visual snapshot is taken at. */
export const FROZEN_NOW = new Date("2026-11-11T10:00:00+06:00");

/** Installs a fixed browser clock that still lets timers run. Call before `page.goto`. */
export async function freezeClock(page: Page): Promise<void> {
  await page.clock.install({ time: FROZEN_NOW });
  await page.clock.resume();
}

/** Screenshot compare after fonts and network settle, with caret and animations off. */
export async function snap(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: `*{caret-color:transparent!important}` });
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: false });
}
