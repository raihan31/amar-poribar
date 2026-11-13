import { describe, expect, it } from "vitest";
import { transactionFormSchema } from "./transactionSchema";

const base = { type: "expense", amount: "850", day: "today", date: "", note: "", fee: "", isPrivate: false };

describe("transactionFormSchema", () => {
  it("rejects zero and > 1 crore", () => {
    expect(transactionFormSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(transactionFormSchema.safeParse({ ...base, amount: "" }).success).toBe(false);
    expect(transactionFormSchema.safeParse({ ...base, amount: "10000001" }).success).toBe(false);
    const ok = transactionFormSchema.safeParse({ ...base, amount: "10000000" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.amountPaisa).toBe(1_000_000_000);
  });

  it("converts taka text to integer paisa, with Bangla digits and a fee", () => {
    const r = transactionFormSchema.parse({ ...base, amount: "৮৫০", fee: "5" });
    expect(r.amountPaisa).toBe(85_000);
    expect(r.feePaisa).toBe(500);
  });

  it("needs a date when the day is other", () => {
    expect(transactionFormSchema.safeParse({ ...base, day: "other", date: "" }).success).toBe(false);
    expect(transactionFormSchema.safeParse({ ...base, day: "other", date: "2026-03-01" }).success).toBe(true);
  });
});
