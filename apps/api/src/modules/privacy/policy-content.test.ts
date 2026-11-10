import { describe, expect, it } from "vitest";
import { loadPolicy, loadPolicyRaw, POLICY_VERSION } from "./domain/policy.js";

/**
 * FR-PRIV-06 figures. T-PRIV-05 will add `retention.ts` with the same numbers; until it exists this table is the
 * single expectation and that task must point this test at its constants.
 */
const RETENTION = {
  soft_deleted: 30,
  voice_video: 180,
  call_logs: 90,
  notifications: 90,
  invites: 30,
  otp: 24,
};

const digits = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

describe("policy content", () => {
  for (const locale of ["bn", "en"] as const) {
    it(`${locale} has the required headings`, () => {
      const text = loadPolicy(locale);
      const headings = text.split("\n").filter((l) => l.startsWith("## "));
      expect(headings.length).toBeGreaterThanOrEqual(6);
      expect(text.startsWith("# ")).toBe(true);
    });
  }

  it("retention numbers match constants", () => {
    for (const locale of ["bn", "en"] as const) {
      const lines = digits(loadPolicyRaw(locale)).split("\n");
      for (const [key, value] of Object.entries(RETENTION)) {
        const line = lines.find((l) => l.includes(`<!--${key}-->`));
        expect(line, `${locale} ${key}`).toBeDefined();
        const numbers = [...(line ?? "").matchAll(/\b\d+\b/g)].map((m) => Number(m[0]));
        expect(numbers, `${locale} ${key}`).toContain(value);
      }
    }
    expect(POLICY_VERSION).toBe("2026-11-01");
  });

  it("mentions cross-border AI, voice notes 180 days, rights and contact", () => {
    const en = loadPolicy("en");
    expect(en).toMatch(/outside Bangladesh/i);
    expect(en).toMatch(/voice notes[^\n]*180 days/i);
    expect(en).toMatch(/within 30 days/i);
    expect(en).toMatch(/privacy@/i);
  });
});
