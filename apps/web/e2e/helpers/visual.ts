import { expect, type Page } from "@playwright/test";

/** Screenshot compare after fonts and network settle, with time-varying parts hidden. */
export async function snap(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content: `*{caret-color:transparent!important}[data-testid=now]{visibility:hidden!important}`,
  });
  await expect(page).toHaveScreenshot(`${name}.png`);
}
