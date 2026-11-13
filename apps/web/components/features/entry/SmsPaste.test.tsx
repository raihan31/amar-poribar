import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { TransactionDraft } from "@amar-poribar/shared";
import { I18nProvider } from "@/lib/i18n/provider";
import { server } from "@/mocks/server";
import type { Account, Category } from "@/lib/types";
import { SmsPaste } from "./SmsPaste";

const F = "*/api/proxy/v1/families/f1";
const SMS =
  "You have sent Tk 2,000.00 to 01712345789. Fee Tk 0.00. Balance Tk 8,450.00. TrxID 9K4L2M7N at 10/11/2026 14:32";

const cats: Category[] = [
  { id: "c1", key: "family", kind: "expense", nameBn: "পরিবারকে সাহায্য", nameEn: "Family", icon: null },
  { id: "c2", key: "bills", kind: "expense", nameBn: "বিল", nameEn: "Bills", icon: null },
  { id: "c3", key: "other", kind: "expense", nameBn: "অন্যান্য", nameEn: "Other", icon: null },
];
const accts = [{ id: "a1", name: "বিকাশ", type: "bkash" }] as unknown as Account[];

const draft: TransactionDraft = {
  type: "expense",
  amountPaisa: 200_000,
  feePaisa: 0,
  occurredAt: "2026-11-10T08:32:00.000Z",
  categoryKey: null,
  accountType: "bkash",
  note: "বিকাশ",
  counterparty: "01712345789",
  trxId: "9K4L2M7N",
  source: "sms",
  confidence: 1,
};

function mockParse(extra: Record<string, unknown> = {}, via = "template") {
  server.use(
    http.post(`${F}/ai/parse`, () => HttpResponse.json({ drafts: [draft], usedAi: via === "llm", via, ...extra })),
  );
}

function setup(onSaved = vi.fn()) {
  render(
    <I18nProvider initial={{ locale: "bn", numerals: "bn", simple: false }}>
      <SmsPaste familyId="f1" categories={cats} accounts={accts} onSaved={onSaved} />
    </I18nProvider>,
  );
  return { onSaved };
}

async function paste() {
  await userEvent.click(screen.getByRole("textbox"));
  await userEvent.paste(SMS);
}

describe("SmsPaste", () => {
  it("template parse shows no-AI line", async () => {
    mockParse();
    setup();
    await paste();
    expect(await screen.findByText("বিকাশ মেসেজ চেনা গেছে · এআই লাগেনি")).toBeInTheDocument();
    expect(screen.getByText("৳ ২,০০০")).toBeInTheDocument();
    expect(screen.getByText("9K4L2M7N")).toBeInTheDocument();
    expect(screen.getByText("এই মেসেজ আগে রাখা হয়নি। কোন খাত?")).toBeInTheDocument();
  });

  it("shows the AI line when not a template", async () => {
    mockParse({}, "llm");
    setup();
    await paste();
    expect(await screen.findByText("এআই দিয়ে বোঝা হয়েছে")).toBeInTheDocument();
  });

  it("duplicate trx shows banner and disables save", async () => {
    mockParse({ isDuplicate: true });
    setup();
    await paste();
    expect(await screen.findByText("এই মেসেজ আগেই রাখা হয়েছে।")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /রাখুন/ })).toBeDisabled();
  });

  it("409 duplicate_trx_id on save shows the banner", async () => {
    mockParse();
    server.use(
      http.post(`${F}/transactions`, () =>
        HttpResponse.json({ error: { code: "duplicate_trx_id", message: "dup" } }, { status: 409 }),
      ),
    );
    const { onSaved } = setup();
    await paste();
    await userEvent.click(await screen.findByRole("button", { name: "বিল" }));
    await userEvent.click(screen.getByRole("button", { name: /রাখুন/ }));
    expect(await screen.findByText("এই মেসেজ আগেই রাখা হয়েছে।")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("saves with the chosen category", async () => {
    mockParse();
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${F}/transactions`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "t1" }, { status: 201 });
      }),
    );
    const { onSaved } = setup();
    await paste();
    const bills = await screen.findByRole("button", { name: "বিল" });
    expect(screen.getByRole("button", { name: /রাখুন/ })).toBeDisabled();
    await userEvent.click(bills);
    await userEvent.click(screen.getByRole("button", { name: /রাখুন/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(body).toMatchObject({ amountPaisa: 200_000, trxId: "9K4L2M7N", categoryId: "c2", source: "sms" });
  });

  it("recipient digits masked", async () => {
    mockParse();
    setup();
    await paste();
    expect(await screen.findByText("০১XXXXX-৭৮৯")).toBeInTheDocument();
    // The card never shows the full number (the user's own pasted text box does).
    const card = screen.getByRole("region", { name: "টাকা পাঠানো" });
    expect(card.textContent).not.toMatch(/01712345789|০১৭১২৩৪৫৭৮৯/);
  });
});
