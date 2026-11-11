import { INBOX_KINDS } from "@amar-poribar/shared";
import { describe, expect, it } from "vitest";
import { TEMPLATE_KEYS, render, sampleParams } from "./templates.js";

describe("templates", () => {
  it("every kind has bn and en", () => {
    for (const kind of INBOX_KINDS) {
      for (const locale of ["bn", "en"] as const) {
        const r = render(kind, locale, sampleParams(kind));
        expect(r.title.length, `${kind}/${locale} title`).toBeGreaterThan(0);
        expect(r.body.length, `${kind}/${locale} body`).toBeGreaterThan(0);
        expect(r.speech.length, `${kind}/${locale} speech`).toBeGreaterThan(0);
      }
    }
    expect([...TEMPLATE_KEYS.bn].sort()).toEqual([...TEMPLATE_KEYS.en].sort());
    expect([...TEMPLATE_KEYS.bn].sort()).toEqual([...INBOX_KINDS].sort());
  });

  it("bn speech contains amount in words (৳ ১,২৫,০০০ → এক লাখ পঁচিশ হাজার টাকা)", () => {
    const r = render("budget_threshold", "bn", { category: "বাজার", threshold: 100, over: 12500000 });
    expect(r.speech).toContain("এক লাখ পঁচিশ হাজার টাকা");
    expect(r.body).toBe("বাজার-এর বাজেট শেষ। ৳ ১,২৫,০০০ বেশি খরচ হয়েছে।");
    expect(r.title).toBe("বাজেট শেষ");
  });

  it("budget 80 exact bn copy", () => {
    const r = render("budget_threshold", "bn", { category: "বাজার", threshold: 80 });
    expect(r.title).toBe("বাজেট ৮০% শেষ");
    expect(r.body).toBe("বাজার-এর বাজেটের ৮০% খরচ হয়ে গেছে।");
    expect(r.speech).toBe("বাজার-এর বাজেটের আশি শতাংশ খরচ হয়ে গেছে।");
  });

  it("bill_due today and in days", () => {
    expect(render("bill_due", "bn", { name: "বিদ্যুৎ", days: 0, amount: 150000 }).body).toBe("বিদ্যুৎ আজ। ৳ ১,৫০০।");
    expect(render("bill_due", "bn", { name: "বিদ্যুৎ", days: 3, amount: 150000 }).body).toBe(
      "বিদ্যুৎ ৩ দিন পর। ৳ ১,৫০০।",
    );
  });

  it("nudge and message", () => {
    const n = render("nudge", "bn", { sender: "আম্মু", phrase: "ভাত খেয়েছ?" });
    expect(n.title).toBe("আম্মু");
    expect(n.speech).toBe("আম্মু বলছেন: ভাত খেয়েছ?");
    expect(render("message", "bn", { sender: "A", media: "voice" }).body).toBe("ভয়েস মেসেজ");
    expect(render("message", "bn", { sender: "A", media: "video" }).body).toBe("ভিডিও মেসেজ");
    expect(render("message", "bn", { sender: "A", text: "x".repeat(200) }).body.length).toBe(80);
  });

  it("title ≤ 40 chars", () => {
    for (const kind of INBOX_KINDS)
      for (const locale of ["bn", "en"] as const)
        expect(render(kind, locale, sampleParams(kind)).title.length).toBeLessThanOrEqual(40);
  });

  it("body ≤ 120 chars except message preview 80", () => {
    for (const kind of INBOX_KINDS)
      for (const locale of ["bn", "en"] as const) {
        const body = render(kind, locale, sampleParams(kind)).body;
        expect(body.length).toBeLessThanOrEqual(kind === "message" ? 80 : 120);
      }
  });

  it("numeral style latin vs bangla", () => {
    const p = { name: "Gas", days: 2, amount: 150000 };
    expect(render("bill_due", "bn", p, { numeralStyle: "bn" }).body).toContain("৳ ১,৫০০");
    expect(render("bill_due", "bn", p, { numeralStyle: "latin" }).body).toContain("৳ 1,500");
    expect(render("bill_due", "en", p).speech).toContain("1,500 taka");
  });
});
