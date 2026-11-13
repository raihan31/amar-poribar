import { expect, needsBackend, test } from "../fixtures/test";
import type { Page } from "@playwright/test";

async function openFirstFamily(page: Page): Promise<void> {
  await page.goto("/families");
  await page
    .getByRole("link", { name: /^Open / })
    .first()
    .click();
  await page.waitForURL(/\/families\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Members", { exact: false }).first()).toBeVisible();
}

test.describe("roles", () => {
  needsBackend(test);

  test("support has no suspend or delete and no staff page", async ({ page, staff }) => {
    await staff("support");
    await openFirstFamily(page);
    await expect(page.getByRole("button", { name: "Change plan" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Suspend family|Unsuspend family/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Delete family/ })).toHaveCount(0);

    await page.goto("/staff");
    await expect(page.getByText("You do not have access")).toBeVisible();
    await expect(page.getByRole("button", { name: /Send invite|Invite/ })).toHaveCount(0);
  });

  test("read-only has no action buttons anywhere", async ({ page, staff }) => {
    await staff("readonly");
    await openFirstFamily(page);
    for (const name of [
      /Change plan/,
      /Add 50 entries/,
      /Suspend family|Unsuspend family/,
      /Delete family/,
      /Transfer/,
    ]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
    await expect(page.getByText("You have read-only access.").first()).toBeVisible();

    await page.goto("/plans");
    await expect(page.getByRole("heading", { name: "Plans & AI quota" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Save|Add|Change|Apply/ })).toHaveCount(0);

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy requests" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Continue|Act now|Reject with|Message the owner)/ })).toHaveCount(
      0,
    );

    await page.goto("/staff");
    await expect(page.getByText("You do not have access")).toBeVisible();
  });
});
