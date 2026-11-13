import { describe, expect, it } from "vitest";
import { statusWords } from "./words.js";

describe("statusWords", () => {
  it("maps each level to label and icon", () => {
    expect(statusWords("ok", { categoryNameBn: "বাজার", overPaisa: 0 })).toMatchObject({
      icon: "check",
      labelBn: "ঠিক আছে",
      labelEn: "OK",
    });
    expect(statusWords("warning", { categoryNameBn: "বাজার", overPaisa: 0 })).toMatchObject({
      icon: "warning",
      labelBn: "সাবধান",
      labelEn: "Careful",
    });
    expect(statusWords("exceeded", { categoryNameBn: "বাজার", overPaisa: 1 })).toMatchObject({
      icon: "error",
      labelBn: "বাজেট শেষ",
      labelEn: "Over budget",
    });
  });

  it("exceeded speech names the overage in words", () => {
    const s = statusWords("exceeded", { categoryNameBn: "বাজার", overPaisa: 120_000 });
    expect(s.speechBn).toBe("বাজার খাতের বাজেট শেষ, এক হাজার দুইশো টাকা বেশি");
  });

  it("warning speech has no digits or percent sign", () => {
    const s = statusWords("warning", { categoryNameBn: "বাজার", overPaisa: 0 });
    expect(s.speechBn).toBe("বাজার খাতের বাজেট প্রায় শেষ");
    expect(s.speechBn).not.toMatch(/[0-9০-৯%]/);
  });
});
