import { describe, expect, it } from "vitest";
import { buildPushData } from "./push-data.js";

describe("push-data", () => {
  it("all values are strings", () => {
    const d = buildPushData(
      "nudge",
      {},
      {
        nudgeId: "n",
        senderId: "s",
        senderName: "A",
        phraseId: 3,
        phrase: "hi",
        intensity: 2,
        quiet: true,
        familyId: "f",
      },
    );
    for (const v of Object.values(d)) expect(typeof v).toBe("string");
    expect(d.kind).toBe("nudge");
    expect(d.v).toBe("1");
    expect(d.familyId).toBe("f");
    expect(d.phraseId).toBe("3");
  });

  it("payload under 3000 bytes", () => {
    expect(() => buildPushData("system", {}, { blob: "x".repeat(3500) })).toThrow(/too large/);
    expect(() => buildPushData("system", {}, { blob: "ক".repeat(1100) })).toThrow(/too large/);
    expect(() => buildPushData("system", {}, { blob: "ok" })).not.toThrow();
  });

  it("nudge payload carries quiet flag", () => {
    expect(buildPushData("nudge", {}, { quiet: true }).quiet).toBe("1");
    expect(buildPushData("nudge", {}, { quiet: false }).quiet).toBe("0");
    expect(buildPushData("nudge", {}, {}).quiet).toBe("0");
  });

  it("message, call and budget keys", () => {
    const m = buildPushData("message", { text: "hello" }, { conversationId: "c", messageId: "m" });
    expect(m.preview).toBe("hello");
    expect(m.conversationId).toBe("c");
    const c = buildPushData("call_incoming", {}, { callId: "1", callerId: "2", callerName: "N", startedAt: "t" });
    expect(c.callerName).toBe("N");
    const b = buildPushData("budget_threshold", { threshold: 80 }, { budgetId: "b" });
    expect(b.threshold).toBe("80");
  });
});
