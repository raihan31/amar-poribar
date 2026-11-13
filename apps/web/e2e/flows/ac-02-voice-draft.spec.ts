import { test, expect, checkA11y, installFakeSpeech } from "../fixtures/test";
import { demo, draft, stub } from "../helpers/mockApi";

const SAID = "আজ বাজারে ৮৫০ টাকা দিলাম ক্যাশে";
const categories = demo.categories.map((c) =>
  c.key === "bazar" ? { ...c, nameBn: "বাজার ও মুদি", nameEn: "Bazaar & Groceries" } : c,
);

test("bazar 850 cash becomes a ৳ ৮৫০ draft @mock", async ({ page, mockUser: _ }) => {
  void _;
  await installFakeSpeech(page, [SAID]);
  await stub(page, "GET", "/v1/families/*/categories", { body: categories });
  await stub(page, "POST", "/v1/families/*/ai/parse", { body: { drafts: [draft()], usedAi: false } });
  let saved: Record<string, unknown> | null = null;
  await stub(page, "POST", "/v1/families/*/transactions", async (route) => {
    saved = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "x" }) });
  });

  // Wait for the categories before speaking, so the draft can be matched to one.
  const loaded = page.waitForResponse((r) => r.url().includes("/categories"));
  await page.goto("/add/voice");
  await loaded;
  await page.getByRole("button", { name: "চাপ দিয়ে বলুন" }).click();

  const card = page.getByRole("region", { name: "শুনে নিন" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("বাজার ও মুদি");
  await expect(card).toContainText(/৳\s?৮৫০/);
  await expect(card).toContainText("ক্যাশ");
  await expect(page.getByText(SAID)).toBeVisible();

  // It was read back aloud before saving.
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect(spoken).toContain("বাজার ও মুদি খাতে আটশো পঞ্চাশ টাকা খরচ। ঠিক আছে?");

  await page.getByRole("button", { name: "হ্যাঁ, রাখুন" }).click();
  await expect(page.getByRole("status")).toContainText("রাখা হয়েছে");
  expect(saved).toMatchObject({ type: "expense", amountPaisa: 85_000, source: "voice" });

  await checkA11y(page);
});
