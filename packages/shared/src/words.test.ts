import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { draftToSpeech } from "./speech.js";
import { amountInWords, monthName, numberToBanglaWords } from "./words.js";

const vectors = JSON.parse(readFileSync(new URL("../test-vectors/bangla-words.json", import.meta.url), "utf8")) as {
  numberToBanglaWords: { n: number; words: string }[];
  amountInWords: { paisa: number; locale: "bn" | "en"; words: string }[];
};

describe("numberToBanglaWords", () => {
  it.each(vectors.numberToBanglaWords)("$n → $words", ({ n, words }) => {
    expect(numberToBanglaWords(n)).toBe(words);
  });
});

describe("amountInWords", () => {
  it.each(vectors.amountInWords)("$paisa ($locale) → $words", ({ paisa, locale, words }) => {
    expect(amountInWords(paisa, locale)).toBe(words);
  });
});

describe("speech", () => {
  it("reads a draft back in simple Bangla", () => {
    const draft = {
      type: "expense",
      amountPaisa: 85_000,
      feePaisa: 0,
      occurredAt: "2026-10-06T10:00:00+06:00",
      categoryKey: "bazaar",
      accountType: "cash",
      note: "বাজার",
      counterparty: null,
      trxId: null,
      source: "voice",
      confidence: 0.9,
    } as const;
    expect(draftToSpeech(draft, "বাজার ও মুদি")).toBe("বাজার ও মুদি খাতে আটশো পঞ্চাশ টাকা খরচ। ঠিক আছে?");
    expect(draftToSpeech({ ...draft, amountPaisa: 50_000 }, null)).toBe(
      "পাঁচশো টাকা খরচ। কিসের জন্য? নিচের ছবিতে চাপ দিন।",
    );
    expect(monthName("2026-10")).toBe("অক্টোবর");
  });
});

import { parseBanglaNumberWords } from "./words.js";

describe("parseBanglaNumberWords", () => {
  it.each([
    ["আজ বাজারে আটশো পঞ্চাশ টাকা", 850],
    ["রিকশা ভাড়া চল্লিশ টাকা", 40],
    ["দেড় হাজার টাকার ওষুধ", 1500],
    ["আড়াই হাজার", 2500],
    ["সাড়ে তিন হাজার টাকা বাসা ভাড়া", 3500],
    ["সাড়ে তিনশো টাকা", 350],
    ["এক লাখ পঁচিশ হাজার", 125000],
    ["দুই হাজার তিনশো চল্লিশ টাকা বিদ্যুৎ বিল", 2340],
    ["একশো টাকা রিচার্জ", 100],
  ])("%s → %i", (text, n) => {
    expect(parseBanglaNumberWords(text)).toBe(n);
  });

  it("returns null without number words", () => {
    expect(parseBanglaNumberWords("বাজার করলাম")).toBeNull();
  });
});
