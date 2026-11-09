import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ClockDriftError, formatHlc, nextHlc, parseHlc, receiveHlc, sendHlc, winsOver } from "./hlc.js";

// Same vectors as apps/mobile/test/data/hlc_test.dart, so both implementations behave identically.
const v = JSON.parse(
  readFileSync(new URL("../../../packages/shared/test-vectors/hlc.json", import.meta.url), "utf8"),
);
const ms = (s: string) => Date.parse(s);

describe("hlc vectors", () => {
  it("formats and parses", () => {
    for (const c of v.format) {
      const h = { time: ms(c.time), counter: c.counter, node: c.node };
      expect(formatHlc(h)).toBe(c.text);
      expect(parseHlc(c.text)).toEqual(h);
    }
  });

  it("string order is clock order", () => {
    for (const c of v.ordering) expect(c.lower < c.higher).toBe(true);
  });

  it("send", () => {
    for (const c of v.send) expect(formatHlc(sendHlc(parseHlc(c.clock), ms(c.now)))).toBe(c.result);
  });

  it("receive", () => {
    for (const c of v.receive) {
      expect(formatHlc(receiveHlc(parseHlc(c.clock), parseHlc(c.remote), ms(c.now)))).toBe(c.result);
    }
  });

  it("rejects a remote clock more than 24h ahead", () => {
    for (const c of v.reject_drift) {
      expect(() => receiveHlc(parseHlc(c.clock), parseHlc(c.remote), ms(c.now))).toThrow(ClockDriftError);
    }
  });
});

describe("server clock", () => {
  it("is strictly increasing, even within one millisecond", () => {
    const now = Date.parse("2026-11-09T10:00:00.000Z");
    const a = nextHlc(null, now);
    const b = nextHlc(null, now);
    const c = nextHlc(null, now - 5000); // wall clock stepping back
    expect(b > a).toBe(true);
    expect(c > b).toBe(true);
  });

  it("sorts after the row it replaces, even if that came from a phone running ahead", () => {
    const ahead = "2030-01-01T00:00:00.000Z-0007-phone";
    expect(nextHlc(ahead, Date.parse("2026-11-09T10:00:00.000Z")) > ahead).toBe(true);
  });

  it("per-record last-write-wins; equal changes nothing", () => {
    expect(winsOver("2026-11-09T10:00:01.000Z-0000-a", "2026-11-09T10:00:00.000Z-0000-b")).toBe(true);
    expect(winsOver("2026-11-09T10:00:00.000Z-0000-a", "2026-11-09T10:00:00.000Z-0000-a")).toBe(false);
    expect(winsOver("2026-11-09T10:00:00.000Z-0000-a", "2026-11-09T10:00:00.000Z-0000-b")).toBe(false);
    expect(winsOver("2026-11-09T10:00:00.000Z-0000-a", null)).toBe(true);
  });
});
