import { describe, expect, it } from "vitest";
import { quickParse } from "./rules.js";

const now = new Date("2026-10-06T08:00:00Z");

describe("quickParse", () => {
  it("reads spoken Bangla with number words", () => {
    const r = quickParse("আজ বাজারে আটশো পঞ্চাশ টাকা ক্যাশে", now);
    expect(r?.complete).toBe(true);
    expect(r?.draft).toMatchObject({ type: "expense", amountPaisa: 85_000, categoryKey: "bazaar", accountType: "cash" });
  });

  it("reads Banglish with digits", () => {
    expect(quickParse("rickshaw 40", now)?.draft).toMatchObject({ amountPaisa: 4_000, categoryKey: "transport" });
    expect(quickParse("DESCO bill 2,340 bkash e", now)?.draft).toMatchObject({
      amountPaisa: 234_000, categoryKey: "electricity", accountType: "bkash",
    });
  });

  it("handles yesterday and medicine", () => {
    const r = quickParse("গতকাল দেড় হাজার টাকার ওষুধ", now);
    expect(r?.draft.categoryKey).toBe("medical");
    expect(r?.draft.amountPaisa).toBe(150_000);
    expect(r?.draft.occurredAt).toBe("2026-10-05T08:00:00.000Z");
  });

  it("detects income", () => {
    expect(quickParse("বেতন পেলাম ৪০০০০", now)?.draft.type).toBe("income");
  });

  it("returns an incomplete draft when no category keyword matches", () => {
    expect(quickParse("৫০০ টাকা দিলাম", now)?.complete).toBe(false);
  });

  it("leaves multi-amount sentences to the AI", () => {
    expect(quickParse("বাজারে ৫০০ আর রিকশায় ৫০", now)).toBeNull();
    expect(quickParse("বাজার করলাম", now)).toBeNull();
  });
});
