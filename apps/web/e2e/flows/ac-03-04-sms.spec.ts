import type { Page } from "@playwright/test";
import { test, expect, checkA11y, loginWithTokens, waitForStack } from "../fixtures/test";
import { demo, draft, problem, stub } from "../helpers/mockApi";
import { fakeClaudeCalls, stackFamily, stackOnce } from "../helpers/stackData";

const trx = () => Math.random().toString(36).slice(2, 10).toUpperCase();
const sms = (id: string) =>
  `You have sent Tk 2,000.00 to 01712345789. Fee Tk 0.00. Balance Tk 8,450.00. TrxID ${id} at 10/11/2026 14:32`;
const BOX = "এখানে মেসেজটি পেস্ট করুন";

async function paste(page: Page, text: string): Promise<void> {
  await page.goto("/add/sms");
  await page.getByLabel(BOX).fill(text);
}

const smsDraft = (id: string) =>
  draft({
    amountPaisa: 200_000,
    categoryKey: null,
    accountType: "bkash",
    counterparty: "01712345789",
    trxId: id,
    source: "sms",
    occurredAt: "2026-11-10T14:32:00+06:00",
    confidence: 1,
  });

test("sms parses without AI @mock", async ({ page, mockUser: _ }) => {
  void _;
  const id = trx();
  await stub(page, "POST", "/v1/families/*/ai/parse", {
    body: { drafts: [smsDraft(id)], usedAi: false, via: "template" },
  });
  await paste(page, sms(id));
  const card = page.getByRole("region", { name: "টাকা পাঠানো" });
  await expect(card).toContainText(/৳\s?২,০০০/);
  await expect(card).toContainText("01XXXXX-789".replace(/\d/g, (d) => String.fromCharCode(0x09e6 + Number(d))));
  await expect(card).toContainText(id);
  await expect(page.getByText("বিকাশ মেসেজ চেনা গেছে · এআই লাগেনি")).toBeVisible();
  await checkA11y(page);
});

test("pasting twice shows already-recorded banner @mock", async ({ page, mockUser: _ }) => {
  void _;
  const id = trx();
  await stub(page, "POST", "/v1/families/*/ai/parse", {
    body: { drafts: [smsDraft(id)], usedAi: false, via: "template" },
  });
  await stub(page, "POST", "/v1/families/*/transactions", problem(409, "duplicate_trx_id"));
  await paste(page, sms(id));
  await page.getByRole("button", { name: demo.categories[0]!.nameBn }).click();
  await page.getByRole("button", { name: "✓ রাখুন" }).click();
  await expect(page.getByText("এই মেসেজ আগেই রাখা হয়েছে।")).toBeVisible();
  await expect(page.getByRole("button", { name: "✓ রাখুন" })).toBeDisabled();
  await checkA11y(page);
});

test("sms parses without AI @stack", async ({ page, context, baseURL }, testInfo) => {
  stackOnce(testInfo);
  await waitForStack();
  const { owner } = await stackFamily();
  await loginWithTokens(context, owner, baseURL!);
  const before = await fakeClaudeCalls();
  await paste(page, sms(trx()));
  await expect(page.getByRole("region", { name: "টাকা পাঠানো" })).toContainText(/৳\s?২,০০০/);
  // Rules and templates answered; the AI service was never called.
  expect(await fakeClaudeCalls()).toBe(before);
  await checkA11y(page);
});

test("pasting twice shows already-recorded banner @stack", async ({ page, context, baseURL }, testInfo) => {
  stackOnce(testInfo);
  await waitForStack();
  const { owner } = await stackFamily();
  await loginWithTokens(context, owner, baseURL!);
  const text = sms(trx());

  await paste(page, text);
  await page.getByRole("button", { name: "অন্যান্য" }).click();
  await page.getByRole("button", { name: "✓ রাখুন" }).click();
  await expect(page).toHaveURL(/\/$/);

  await paste(page, text);
  const dup = page.getByText("এই মেসেজ আগেই রাখা হয়েছে।");
  const other = page.getByRole("button", { name: "অন্যান্য" });
  // The parser may flag the duplicate up front, or the save answers 409 duplicate_trx_id.
  await expect(dup.or(other)).toBeVisible();
  if (await other.isVisible()) {
    await other.click();
    await page.getByRole("button", { name: "✓ রাখুন" }).click();
  }
  await expect(dup).toBeVisible();
  await checkA11y(page);
});
