import { test, expect, checkA11y } from "../fixtures/test";

test("home loads in mock mode and passes axe @mock", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "ap_loc", value: "bn", url: baseURL! }]);
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await checkA11y(page);
});
