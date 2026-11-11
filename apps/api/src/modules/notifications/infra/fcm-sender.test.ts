import { describe, expect, it, vi } from "vitest";
import { FcmSender, type FcmMessaging } from "./fcm-sender.js";
import type { PushMessage } from "./push-sender.js";

const msg = (token: string): PushMessage => ({
  token,
  deviceId: "d",
  priority: "high",
  ttlSeconds: 60,
  collapseKey: "c",
  data: { kind: "nudge", v: "1" },
});
const ok = { success: true };
const fail = (code: string) => ({ success: false, error: { code } });

describe("FcmSender", () => {
  it("maps UNREGISTERED", async () => {
    const m: FcmMessaging = {
      sendEach: vi.fn().mockResolvedValue({
        responses: [
          fail("messaging/registration-token-not-registered"),
          fail("messaging/invalid-registration-token"),
          ok,
        ],
      }),
    };
    const res = await new FcmSender(m).send([msg("a"), msg("b"), msg("c")]);
    expect(res).toEqual([
      { token: "a", ok: false, error: "UNREGISTERED" },
      { token: "b", ok: false, error: "UNREGISTERED" },
      { token: "c", ok: true },
    ]);
  });

  it("retries UNAVAILABLE three times", async () => {
    const sendEach = vi.fn().mockResolvedValue({ responses: [fail("messaging/server-unavailable")] });
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const res = await new FcmSender({ sendEach }, { sleep, random: () => 0.5 }).send([msg("a")]);
    expect(sendEach).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 3000, 9000]);
    expect(res).toEqual([{ token: "a", ok: false, error: "UNAVAILABLE" }]);
  });

  it("retries only failed retryable messages", async () => {
    const sendEach = vi
      .fn()
      .mockResolvedValueOnce({
        responses: [fail("messaging/message-rate-exceeded"), fail("messaging/invalid-argument")],
      })
      .mockResolvedValueOnce({ responses: [ok] });
    const res = await new FcmSender({ sendEach }, { sleep: async () => {} }).send([msg("a"), msg("b")]);
    expect(sendEach).toHaveBeenCalledTimes(2);
    expect(sendEach.mock.calls[1]![0]).toHaveLength(1);
    expect(res).toEqual([
      { token: "a", ok: true },
      { token: "b", ok: false, error: "INVALID_ARGUMENT" },
    ]);
  });

  it("never sets notification block", async () => {
    const sendEach = vi.fn().mockResolvedValue({ responses: [ok] });
    await new FcmSender({ sendEach }).send([msg("a")]);
    const sent = sendEach.mock.calls[0]![0][0];
    expect(sent).not.toHaveProperty("notification");
    expect(sent.android).toEqual({ priority: "HIGH", ttl: 60000, collapseKey: "c", directBootOk: true });
    expect(sent.data).toEqual({ kind: "nudge", v: "1" });
  });

  it("batches 500", async () => {
    const sendEach = vi.fn(async (ms: object[]) => ({ responses: ms.map(() => ok) }));
    const res = await new FcmSender({ sendEach }).send(Array.from({ length: 1201 }, (_, i) => msg(`t${i}`)));
    expect(sendEach.mock.calls.map((c) => c[0].length)).toEqual([500, 500, 201]);
    expect(res).toHaveLength(1201);
    expect(res.every((r) => r.ok)).toBe(true);
  });
});
