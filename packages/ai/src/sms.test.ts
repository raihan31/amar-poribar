import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { looksLikeMfsSms, maskPhone, parseMfsSms } from "./sms.js";

const vectors = JSON.parse(
  readFileSync(new URL("../../shared/test-vectors/sms-parser.json", import.meta.url), "utf8"),
) as {
  cases: { name: string; text: string; expected: Record<string, unknown> | null }[];
};

describe("parseMfsSms", () => {
  it.each(vectors.cases)("$name", ({ text, expected }) => {
    const d = parseMfsSms(text);
    if (expected === null) {
      expect(d).toBeNull();
      expect(looksLikeMfsSms(text)).toBe(false);
    } else {
      expect(d).toMatchObject(expected);
    }
  });

  it("masks phone numbers", () => {
    expect(maskPhone("to +8801712345678")).toBe("to 01XXXXXX678");
  });
});
