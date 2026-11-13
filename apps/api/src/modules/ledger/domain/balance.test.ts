import { describe, expect, it } from "vitest";
import { balanceOf, type BalanceRow } from "./balance.js";

const A = "a";
const B = "b";
const row = (over: Partial<BalanceRow>): BalanceRow => ({
  type: "expense",
  accountId: A,
  toAccountId: null,
  amountPaisa: 0,
  feePaisa: 0,
  ...over,
});

describe("balanceOf", () => {
  it("income and expense", () => {
    const rows = [row({ type: "income", amountPaisa: 10_000 }), row({ type: "expense", amountPaisa: 3_000 })];
    expect(balanceOf(A, 0, rows)).toBe(7_000);
  });

  it("fee reduces the balance", () => {
    expect(balanceOf(A, 0, [row({ type: "expense", amountPaisa: 1_000, feePaisa: 50 })])).toBe(-1_050);
  });

  it("transfer moves money and fee leaves the source", () => {
    const t = row({ type: "transfer", accountId: A, toAccountId: B, amountPaisa: 5_000, feePaisa: 25 });
    expect(balanceOf(A, 10_000, [t])).toBe(4_975);
    expect(balanceOf(B, 0, [t])).toBe(5_000);
  });

  it("opening balance counts", () => {
    expect(balanceOf(A, 12_345, [])).toBe(12_345);
  });

  it("ignores rows of other accounts", () => {
    expect(balanceOf(A, 0, [row({ type: "income", accountId: B, amountPaisa: 99 })])).toBe(0);
  });
});
