import { describe, expect, it } from "vitest";
import { AiUnavailableError } from "./llm.js";
import { assertSafeTemplate, buildFacts, renderSummary, templateSummary, type SummaryInput } from "./summary.js";

const input: SummaryInput = {
  month: "2026-10",
  locale: "bn",
  expensePaisa: 2_534_000,
  incomePaisa: 6_000_000,
  lastMonthExpensePaisa: 2_200_000,
  categories: [
    { name: "বাজার ও মুদি", paisa: 1_200_000, lastMonthPaisa: 1_000_000 },
    { name: "বিদ্যুৎ বিল", paisa: 234_000, lastMonthPaisa: 210_000 },
  ],
};

describe("templateSummary", () => {
  it("writes digits on screen and words for speech", () => {
    const out = templateSummary(input);
    expect(out.text).toBe(
      "অক্টোবর মাসে পরিবারের মোট খরচ ৳ ২৫,৩৪০। গত মাসের চেয়ে ৳ ৩,৩৪০ বেশি। সবচেয়ে বেশি খরচ বাজার ও মুদি খাতে, ৳ ১২,০০০। এই মাসে আয় ৳ ৬০,০০০।",
    );
    expect(out.speechText).toContain("পঁচিশ হাজার তিনশো চল্লিশ টাকা");
    expect(out.speechText).not.toMatch(/[0-9০-৯]/);
  });

  it("handles an empty month and English", () => {
    expect(templateSummary({ ...input, expensePaisa: 0, categories: [] }).text).toContain("এখনো কোনো খরচ লেখা হয়নি");
    expect(templateSummary({ ...input, locale: "en" }).text).toContain("In October the family spent ৳ 25,340.");
  });
});

describe("assertSafeTemplate", () => {
  const facts = buildFacts(input);

  it("accepts placeholders only", () => {
    expect(() => assertSafeTemplate("মোট খরচ {TOTAL}, বাজারে {C1}।", facts)).not.toThrow();
  });

  it("rejects invented numbers and unknown placeholders", () => {
    expect(() => assertSafeTemplate("মোট খরচ ২৫০০০ টাকা।", facts)).toThrow(AiUnavailableError);
    expect(() => assertSafeTemplate("খরচ {C9}।", facts)).toThrow(AiUnavailableError);
  });

  it("renders the model's template", () => {
    expect(renderSummary("বাজারে {C1}।", facts, "bn").speechText).toBe("বাজারে বারো হাজার টাকা।");
  });
});
