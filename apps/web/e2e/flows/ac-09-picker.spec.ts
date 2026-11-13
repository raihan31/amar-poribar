import { test, expect, checkA11y, installFakeSpeech } from "../fixtures/test";
import { draft, stub } from "../helpers/mockApi";

test("পাঁচশো টাকা দিলাম opens the picker @mock", async ({ page, mockUser: _ }) => {
  void _;
  await installFakeSpeech(page, ["পাঁচশো টাকা দিলাম"]);
  // No category in what was said, so the server draft has none (AC-09).
  await stub(page, "POST", "/v1/families/*/ai/parse", {
    body: { drafts: [draft({ amountPaisa: 50_000, categoryKey: null, accountType: null })], usedAi: false },
  });

  const loaded = page.waitForResponse((r) => r.url().includes("/categories"));
  await page.goto("/add/voice");
  await loaded;
  await page.getByRole("button", { name: "চাপ দিয়ে বলুন" }).click();

  // A4: "pick a category" with the amount on top, nothing chosen yet.
  await expect(page.getByRole("heading", { name: "খাত বাছুন" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "কিসের জন্য?" })).toBeVisible();
  await expect(page.getByText(/৳\s?৫০০/)).toBeVisible();
  await expect(page.getByRole("button", { name: "খাত বেছে নিন" })).toBeDisabled();
  await expect(page.getByRole("group", { name: "ক্যাটাগরি" }).getByRole("button")).not.toHaveCount(0);
  await checkA11y(page);
});
