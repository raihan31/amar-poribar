import { describe, expect, it } from "vitest";
import { MemoryOtpStore } from "./infra/otp-store.memory.js";

describe("otp store", () => {
  it("accepts the issued code once", async () => {
    const store = new MemoryOtpStore();
    const code = await store.issue("+8801712345678");
    expect(code).toMatch(/^\d{6}$/);
    expect(await store.verify("+8801712345678", code)).toBe(true);
    expect(await store.verify("+8801712345678", code)).toBe(false);
  });

  it("otp expires", async () => {
    let now = 1_000_000;
    const store = new MemoryOtpStore(() => now);
    const code = await store.issue("+8801712345678");
    now += 5 * 60_000 + 1;
    expect(await store.verify("+8801712345678", code)).toBe(false);
  });

  it("otp locks after 5 attempts", async () => {
    const store = new MemoryOtpStore();
    const code = await store.issue("+8801712345678");
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(await store.verify("+8801712345678", wrong)).toBe(false);
    expect(await store.verify("+8801712345678", code)).toBe(false);
  });
});
