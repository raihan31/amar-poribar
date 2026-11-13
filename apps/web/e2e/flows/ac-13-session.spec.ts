import { test, expect, checkA11y } from "../fixtures/test";
import { demo, listItems, problem, stub } from "../helpers/mockApi";

test("expired refresh shows F6 and returns to the same screen @mock", async ({ page, mockUser: _ }) => {
  void _;
  // The refresh token is dead: the BFF answers 401 session_expired to the first list call only.
  let expired = true;
  await stub(page, "GET", "/v1/families/*/transactions", (route) => {
    if (expired) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify(problem(401, "session_expired").body),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: listItems(3), nextCursor: null }),
    });
  });
  await stub(page, "POST", "/api/auth/otp/request", { body: { sent: true } });
  await stub(page, "POST", "/api/auth/otp/verify", async (route) => {
    expired = false;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, user: demo.me, families: [demo.family] }),
    });
  });

  await page.goto("/list");

  // F6: friendly card, and the screen we were on is remembered.
  await expect(page).toHaveURL(/\/session-expired\?next=%2Flist$/);
  await expect(page.getByRole("heading", { name: "আবার ঢুকুন" })).toBeVisible();
  await checkA11y(page);
  await page.getByRole("button", { name: "নম্বর দিয়ে ঢুকুন" }).click();

  await expect(page).toHaveURL(/\/login\?next=%2Flist$/);
  await page.getByLabel("আপনার মোবাইল নম্বর দিন").fill("01712345678");
  await page.getByRole("button", { name: "কোড পাঠান" }).click();
  await page
    .getByRole("textbox", { name: /^কোডের/ })
    .first()
    .click();
  await page.keyboard.type("123456");

  await expect(page).toHaveURL(/\/list$/);
  await expect(page.getByRole("heading", { name: "খরচের তালিকা" })).toBeVisible();
  await expect(page.locator("li.txn-row")).toHaveCount(3);
  await checkA11y(page);
});
