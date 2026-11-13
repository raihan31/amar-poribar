import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bnToLatinDigits, formatBDT, parseAmountToPaisa, takaToPaisa } from "./money.js";
import { BdPhoneSchema, normalizeBdPhone } from "./schemas.js";

const vectors = JSON.parse(readFileSync(new URL("../test-vectors/money-ts.json", import.meta.url), "utf8")) as {
  bnToLatinDigits: { input: string; output: string }[];
  parseAmountToPaisa: { input: string; paisa: number | null }[];
  takaToPaisa: { taka: number; paisa: number }[];
  formatBDT: { paisa: number; bnDigits: boolean; text: string }[];
};

describe("money", () => {
  it.each(vectors.bnToLatinDigits)("converts Bangla digits: $input", ({ input, output }) => {
    expect(bnToLatinDigits(input)).toBe(output);
  });

  it.each(vectors.parseAmountToPaisa)("parses amount: $input", ({ input, paisa }) => {
    expect(parseAmountToPaisa(input)).toBe(paisa);
  });

  it.each(vectors.takaToPaisa)("avoids float drift: $taka", ({ taka, paisa }) => {
    expect(takaToPaisa(taka)).toBe(paisa);
  });

  it.each(vectors.formatBDT)("formats $paisa", ({ paisa, bnDigits, text }) => {
    expect(formatBDT(paisa, { bnDigits })).toBe(text);
  });
});

describe("phone", () => {
  it("validates and normalises BD numbers", () => {
    expect(BdPhoneSchema.safeParse("01712345678").success).toBe(true);
    expect(BdPhoneSchema.safeParse("+8801912345678").success).toBe(true);
    expect(BdPhoneSchema.safeParse("01212345678").success).toBe(false);
    expect(normalizeBdPhone("01712-345678")).toBe("+8801712345678");
  });
});
