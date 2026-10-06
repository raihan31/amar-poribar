import { describe, expect, it } from "vitest";
import { draftToSpeech } from "./speech.js";
import { amountInWords, monthName, numberToBanglaWords } from "./words.js";

describe("numberToBanglaWords", () => {
  it.each([
    [0, "শূন্য"],
    [15, "পনেরো"],
    [99, "নিরানব্বই"],
    [100, "একশো"],
    [850, "আটশো পঞ্চাশ"],
    [2340, "দুই হাজার তিনশো চল্লিশ"],
    [10_000, "দশ হাজার"],
    [1_25_000, "এক লাখ পঁচিশ হাজার"],
    [1_00_00_000, "এক কোটি"],
    [2_05_03_021, "দুই কোটি পাঁচ লাখ তিন হাজার একুশ"],
    [150_00_00_000, "একশো পঞ্চাশ কোটি"],
  ])("%i → %s", (n, words) => {
    expect(numberToBanglaWords(n)).toBe(words);
  });
});

describe("amountInWords", () => {
  it("includes paisa", () => {
    expect(amountInWords(234_050)).toBe("দুই হাজার তিনশো চল্লিশ টাকা পঞ্চাশ পয়সা");
    expect(amountInWords(85_000, "en")).toBe("850 taka");
  });
});

describe("speech", () => {
  it("reads a draft back in simple Bangla", () => {
    const draft = {
      type: "expense", amountPaisa: 85_000, feePaisa: 0, occurredAt: "2026-10-06T10:00:00+06:00",
      categoryKey: "bazaar", accountType: "cash", note: "বাজার", counterparty: null, trxId: null,
      source: "voice", confidence: 0.9,
    } as const;
    expect(draftToSpeech(draft, "বাজার ও মুদি")).toBe("বাজার ও মুদি খাতে আটশো পঞ্চাশ টাকা খরচ। ঠিক আছে?");
    expect(draftToSpeech({ ...draft, amountPaisa: 50_000 }, null)).toBe("পাঁচশো টাকা খরচ। কিসের জন্য? নিচের ছবিতে চাপ দিন।");
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
