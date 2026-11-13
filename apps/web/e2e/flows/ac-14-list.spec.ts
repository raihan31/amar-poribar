import { test, expect, checkA11y } from "../fixtures/test";
import { demo, listItems, stub } from "../helpers/mockApi";

const SIZES = [50, 50, 20]; // 120 rows in exactly 3 pages

test("120 rows load in 3 pages and undo delete works @mock", async ({ page, mockUser: _ }, testInfo) => {
  void _;
  const cursors: Array<string | null> = [];
  await stub(page, "GET", "/v1/families/*/transactions", (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    cursors.push(cursor);
    const index = cursor ? Number(cursor.replace("p", "")) : 0;
    const from = SIZES.slice(0, index).reduce((a, b) => a + b, 0);
    const next = index + 1 < SIZES.length ? `p${index + 1}` : null;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: listItems(SIZES[index]!, from), nextCursor: next }),
    });
  });

  await page.goto("/list");
  const rows = page.locator("li.txn-row");
  const more = page.getByRole("button", { name: "আরও দেখুন" });
  await expect(rows).toHaveCount(50);
  await more.click();
  await expect(rows).toHaveCount(100);
  await more.click();
  await expect(rows).toHaveCount(120);
  await expect(more).toHaveCount(0);
  expect(cursors).toEqual([null, "p1", "p2"]);
  // Stable order: the notes run row 1 to row 120 without a gap or repeat.
  const notes = await page.getByTestId("txn-name").allInnerTexts();
  expect(notes).toEqual(Array.from({ length: 120 }, (_, i) => `row ${i + 1}`));
  await checkA11y(page);

  // Delete one entry, then bring it back within the 30 days.
  await page.goto(`/txn/${demo.transactions[testInfo.project.name === "mobile" ? 0 : 1]!.id}`);
  await page.getByRole("button", { name: "মুছুন", exact: true }).click();
  await page.getByRole("button", { name: "হ্যাঁ, মুছুন" }).click();
  await expect(page.getByText("মুছে ফেলা হয়েছে। ৩০ দিন পর্যন্ত ফেরত পাবেন।")).toBeVisible();
  await page.getByRole("button", { name: "ফেরত আনুন" }).click();
  await expect(page.getByRole("button", { name: "মুছুন", exact: true })).toBeVisible();
  await expect(page.getByText("মুছে ফেলা হয়েছে।")).toHaveCount(0);
  await checkA11y(page);
});
