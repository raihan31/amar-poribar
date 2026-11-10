import { describe, expect, it } from "vitest";
import { MemoryPush } from "./memory-push.js";
import { MemorySms } from "./memory-sms.js";

describe("memory fakes", () => {
  it("memory sms failNext produces failed status", async () => {
    const sms = new MemorySms();
    sms.failNext();
    expect((await sms.send({ to: "+880", text: "1", kind: "otp" })).status).toBe("failed");
    expect((await sms.send({ to: "+880", text: "2", kind: "otp" })).status).toBe("sent");
    expect(sms.last()?.text).toBe("2");
    sms.clear();
    expect(sms.sent).toHaveLength(0);
  });

  it("memory push failNext produces the given outcome", async () => {
    const p = new MemoryPush();
    const m = { token: "t", platform: "android" as const, data: {}, priority: "high" as const, ttlSeconds: 60 };
    p.failNext("unregistered");
    expect((await p.send(m)).outcome).toBe("unregistered");
    expect((await p.send(m)).outcome).toBe("ok");
    expect(p.sent).toHaveLength(1);
  });
});
