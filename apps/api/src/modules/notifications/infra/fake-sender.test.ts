import { describe, expect, it } from "vitest";
import { FakePushSender } from "./fake-sender.js";
import type { PushMessage } from "./push-sender.js";

const msg = (token: string, kind = "nudge"): PushMessage => ({
  token,
  deviceId: "d1",
  priority: "high",
  ttlSeconds: 60,
  data: { kind, v: "1" },
});

describe("FakePushSender", () => {
  it("waitFor resolves", async () => {
    const sink = new FakePushSender(() => new Date("2026-01-01T00:00:00Z"));
    const p = sink.waitFor((m) => m.data.kind === "message", 1000);
    await sink.send([msg("a", "nudge"), msg("b", "message")]);
    const hit = await p;
    expect(hit.token).toBe("b");
    expect(hit.sentAt).toBe("2026-01-01T00:00:00.000Z");
    await expect(sink.waitFor((m) => m.token === "zzz", 20)).rejects.toThrow(/no matching/);
  });

  it("failToken works", async () => {
    const sink = new FakePushSender();
    sink.failToken("bad", "UNREGISTERED");
    const res = await sink.send([msg("bad"), msg("good")]);
    expect(res).toEqual([
      { token: "bad", ok: false, error: "UNREGISTERED" },
      { token: "good", ok: true },
    ]);
    expect(sink.messages().map((m) => m.token)).toEqual(["good"]);
  });
});
