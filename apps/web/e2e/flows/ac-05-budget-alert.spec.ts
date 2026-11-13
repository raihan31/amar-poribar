import { test, expect, checkA11y } from "../fixtures/test";
import { demo, stub } from "../helpers/mockApi";

test("80 percent budget strip appears @mock", async ({ page, mockUser: _ }) => {
  void _;
  const bazar = demo.categories[0]!;
  // ৳ 10,000 budget with ৳ 8,100 spent, as integer paisa.
  await stub(page, "GET", "/v1/families/*/budgets", {
    body: {
      budgets: [
        {
          categoryId: bazar.id,
          nameBn: bazar.nameBn,
          nameEn: bazar.nameEn,
          limitPaisa: 1_000_000,
          spentPaisa: 810_000,
          level: "warning",
          inherited: false,
        },
      ],
    },
  });
  await page.goto("/");

  const strip = page.locator(".home-budget");
  await expect(strip).toBeVisible();
  await expect(strip).toContainText("৮১%");
  await expect(strip.getByRole("link", { name: "আম্মুকে জানান" })).toBeVisible();
  await checkA11y(page);
});
