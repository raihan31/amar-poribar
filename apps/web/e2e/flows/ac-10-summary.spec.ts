import { amountInWords } from "@amar-poribar/shared";
import { test, expect, checkA11y, installFakeSpeech } from "../fixtures/test";
import { demo, stub } from "../helpers/mockApi";

const EXPENSE = 1_234_500; // ৳ 12,345 in paisa

test("screen shows ৳ and Listen speaks words @mock", async ({ page, mockUser: _ }) => {
  void _;
  await installFakeSpeech(page, []);
  const words = amountInWords(EXPENSE, "bn");
  const speech = `এই মাসে ${words} খরচ হয়েছে।`;
  await stub(page, "GET", "/v1/families/*/reports/summary", {
    body: {
      month: new Date().toISOString().slice(0, 7),
      incomePaisa: 0,
      expensePaisa: EXPENSE,
      previous: { month: "2000-01", incomePaisa: 0, expensePaisa: 1_000_000 },
      byCategory: demo.categories.map((c) => ({ categoryId: c.id, name: c.nameBn, totalPaisa: 0 })),
      byMember: [],
      byAccount: [],
    },
  });
  await stub(page, "GET", "/v1/families/*/ai/summary", {
    body: { month: "2026-11", locale: "bn", text: "এই মাসে ৳ ১২,৩৪৫ খরচ হয়েছে।", speechText: speech, usedAi: false },
  });
  await page.goto("/");

  // The screen shows digits with ৳, the spoken text says the same amount in words.
  await expect(page.locator(".home-month-amount")).toHaveText(/৳\s?১২,৩৪৫/);
  await page.getByRole("button", { name: "শুনুন" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken))
    .toContain(speech);
  await checkA11y(page);
});
