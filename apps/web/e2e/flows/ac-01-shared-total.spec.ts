import type { Page } from "@playwright/test";
import { test, expect, checkA11y, loginWithTokens, waitForStack } from "../fixtures/test";
import { stackFamily, stackOnce } from "../helpers/stackData";

async function addExpense(page: Page, taka: string): Promise<void> {
  await page.goto("/add");
  await page.getByLabel("কত টাকা?").fill(taka);
  await page.getByRole("button", { name: "রাখুন", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("রাখা হয়েছে");
  await expect(page).toHaveURL(/\/$/);
}

const monthTotal = (page: Page) => page.locator(".home-month-amount").innerText();

test("two members see the same month total within 5 seconds @stack", async ({ browser, baseURL }, testInfo) => {
  stackOnce(testInfo);
  await waitForStack();
  const { owner, member } = await stackFamily();
  const shathi = await browser.newContext({ baseURL, locale: "bn-BD", timezoneId: "Asia/Dhaka" });
  const rahim = await browser.newContext({ baseURL, locale: "bn-BD", timezoneId: "Asia/Dhaka" });
  try {
    await loginWithTokens(shathi, owner, baseURL!);
    await loginWithTokens(rahim, member, baseURL!);
    const [a, b] = await Promise.all([shathi.newPage(), rahim.newPage()]);

    await addExpense(a, "120");
    await addExpense(b, "230");

    // Both reload Home and must agree on ৳ ৩৫০ within 5 seconds.
    for (const p of [a, b]) {
      await p.reload();
      await expect.poll(() => monthTotal(p), { timeout: 5000 }).toMatch(/৳\s?৩৫০/);
    }
    expect(await monthTotal(a)).toBe(await monthTotal(b));
    await checkA11y(a);
  } finally {
    await shathi.close();
    await rahim.close();
  }
});
