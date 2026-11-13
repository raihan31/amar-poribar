import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { draftToSpeech, type TransactionDraft } from "@amar-poribar/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Category } from "@/lib/types";
import { toDraftView } from "@/lib/entry/quickParse";
import { DraftReadBack } from "./DraftReadBack";

const cat: Category = {
  id: "c1",
  key: "grocery",
  kind: "expense",
  nameBn: "বাজার ও মুদি",
  nameEn: "Groceries",
  icon: null,
};
const draft: TransactionDraft = {
  type: "expense",
  amountPaisa: 85_000,
  feePaisa: 0,
  occurredAt: new Date().toISOString(),
  categoryKey: "grocery",
  accountType: "cash",
  note: "বাজার",
  counterparty: null,
  trxId: null,
  source: "voice",
  confidence: 0.9,
};

beforeEach(() => {
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
});

function setup(props: Partial<Parameters<typeof DraftReadBack>[0]> = {}, simple = false) {
  const onYes = vi.fn();
  const onNo = vi.fn();
  const utils = render(
    <I18nProvider initial={{ locale: "bn", numerals: "bn", simple }}>
      <DraftReadBack
        transcript="আজ বাজারে আটশো পঞ্চাশ টাকা ক্যাশে"
        view={toDraftView(draft, [cat])}
        onYes={onYes}
        onNo={onNo}
        changeHref="/add?draft=x"
        {...props}
      />
    </I18nProvider>,
  );
  return { ...utils, onYes, onNo };
}

describe("DraftReadBack", () => {
  it("speaks the Bangla read-back sentence once", async () => {
    const { rerender } = setup();
    const expected = draftToSpeech(draft, "বাজার ও মুদি");
    expect(expected).toBe("বাজার ও মুদি খাতে আটশো পঞ্চাশ টাকা খরচ। ঠিক আছে?");
    expect(globalThis.__spoken).toEqual([expected]);
    expect(screen.getByText("৳ ৮৫০")).toBeInTheDocument();
    expect(screen.getByText("আটশো পঞ্চাশ টাকা")).toBeInTheDocument();
    expect(screen.getByText("খরচ · ক্যাশ · আজ")).toBeInTheDocument();
    rerender(
      <I18nProvider initial={{ locale: "bn", numerals: "bn", simple: false }}>
        <DraftReadBack
          transcript="x"
          view={toDraftView(draft, [cat])}
          onYes={() => {}}
          onNo={() => {}}
          changeHref="/add"
        />
      </I18nProvider>,
    );
    expect(globalThis.__spoken).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "আবার শুনুন" }));
    expect(globalThis.__spoken).toHaveLength(2);
  });

  it("no button smaller than 104px", () => {
    setup();
    const no = screen.getByRole("button", { name: "না" });
    const yes = screen.getByRole("button", { name: "হ্যাঁ, রাখুন" });
    for (const b of [no, yes]) expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(104);
    expect(parseInt(no.style.minWidth, 10)).toBeGreaterThanOrEqual(104);
  });

  it("answers call back and the change link carries the draft", async () => {
    const { onYes, onNo } = setup();
    await userEvent.click(screen.getByRole("button", { name: "হ্যাঁ, রাখুন" }));
    await userEvent.click(screen.getByRole("button", { name: "না" }));
    expect(onYes).toHaveBeenCalledOnce();
    expect(onNo).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "টাকা বা খাত বদলাতে চাই" })).toHaveAttribute("href", "/add?draft=x");
  });

  it("simple mode speaks again when the draft changes", () => {
    const { rerender } = setup({}, true);
    rerender(
      <I18nProvider initial={{ locale: "bn", numerals: "bn", simple: true }}>
        <DraftReadBack
          transcript="x"
          view={toDraftView({ ...draft, amountPaisa: 90_000 }, [cat])}
          onYes={() => {}}
          onNo={() => {}}
          changeHref="/add"
        />
      </I18nProvider>,
    );
    expect(globalThis.__spoken).toHaveLength(2);
  });
});
