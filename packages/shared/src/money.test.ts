import { describe, expect, it } from "vitest";
import { bnToLatinDigits, formatBDT, parseAmountToPaisa, takaToPaisa } from "./money.js";
import { BdPhoneSchema, normalizeBdPhone } from "./schemas.js";

describe("money", () => {
  it("converts Bangla digits", () => {
    expect(bnToLatinDigits("৮৫০ টাকা")).toBe("850 টাকা");
  });

  it("parses lakh-grouped and Bangla amounts", () => {
    expect(parseAmountToPaisa("1,00,000")).toBe(10_000_000);
    expect(parseAmountToPaisa("৳ ২,৩৪০.৫০")).toBe(234_050);
    expect(parseAmountToPaisa("no number")).toBeNull();
  });

  it("avoids float drift", () => {
    expect(takaToPaisa(19.99)).toBe(1999);
  });

  it("formats with lakh grouping", () => {
    expect(formatBDT(12_500_000)).toBe("৳ 1,25,000");
    expect(formatBDT(1_000_000_000)).toBe("৳ 1,00,00,000");
    expect(formatBDT(85_050, { bnDigits: true })).toBe("৳ ৮৫০.৫০");
    expect(formatBDT(-5000)).toBe("৳ -50");
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
