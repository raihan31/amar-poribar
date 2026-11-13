import { CSRF, expect, needsBackend, test } from "../fixtures/test";
import type { Page } from "@playwright/test";

/**
 * AC-30: every staff action needs a reason, destructive ones also need the family name typed, and every
 * successful action appends an audit entry whose hash chain verifies.
 * Runs against the mock admin API (`MOCK=1`) or the Compose stack (`ADMIN_E2E_STACK_URL`).
 */
async function openFirstFamily(page: Page): Promise<string> {
  await page.goto("/families");
  await page
    .getByRole("link", { name: /^Open / })
    .first()
    .click();
  await page.waitForURL(/\/families\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
}

test.describe("AC-30 staff actions", () => {
  needsBackend(test);

  test("actions need a reason", async ({ page, staff }) => {
    await staff("owner");
    const familyId = await openFirstFamily(page);
    await page.getByRole("button", { name: "Change plan" }).click();
    const dialog = page.getByRole("dialog", { name: "Change plan" });
    await dialog.getByLabel(/Reason/).fill("short");
    await expect(dialog.getByRole("button", { name: "Change plan" })).toBeDisabled();
    await dialog.getByLabel(/Reason/).fill("Customer asked by phone");
    await expect(dialog.getByRole("button", { name: "Change plan" })).toBeEnabled();

    // Forcing the request through the API without a reason is refused by the server.
    const res = await page.request.post(`/api/proxy/admin/v1/families/${encodeURIComponent(familyId)}/plan`, {
      headers: { ...CSRF, "idempotency-key": crypto.randomUUID() },
      data: { plan: "plus" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(await res.text()).toContain("reason_required");
  });

  test("delete needs typed family name", async ({ page, staff }) => {
    await staff("owner");
    await openFirstFamily(page);
    const name = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
    await page.getByRole("button", { name: /^Delete family and data/ }).click();
    const dialog = page.getByRole("dialog", { name: "Delete family and data" });
    const confirm = dialog.getByRole("button", { name: "Delete family" });
    await dialog.getByLabel(/Reason/).fill("Owner asked us to remove it");
    await dialog.getByLabel("I understand this starts the 30-day deletion process").check();
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Type the family name to confirm").fill(`${name} x`);
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Type the family name to confirm").fill(name);
    await expect(confirm).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("successful action appends an audit entry whose chain verifies", async ({ page, staff }) => {
    await staff("owner");
    await openFirstFamily(page);
    const name = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
    await page.getByRole("button", { name: "Suspend family" }).click();
    const dialog = page.getByRole("dialog", { name: "Suspend family" });
    await dialog.getByLabel(/Reason/).fill("Abuse report 4890 confirmed");
    await dialog.getByLabel("Type the family name to confirm").fill(name);
    await dialog.getByRole("button", { name: "Suspend" }).click();
    await expect(page.getByText("Done. Recorded in the audit log.")).toBeVisible();

    await page.goto("/audit");
    const top = page.getByRole("row").nth(1);
    await expect(top).toContainText("Suspended family");
    await expect(top).toContainText("Risky");
    await expect(page.getByTestId("chain-status")).toContainText("Chain verified");
  });
});
