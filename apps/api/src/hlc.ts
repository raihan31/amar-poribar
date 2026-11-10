import { randomBytes } from "node:crypto";

/**
 * Hybrid logical clock (SRS FR-SYNC-02). Fixed-width string so plain string comparison orders events:
 * time, then counter, then node id. Same rules as apps/mobile/lib/data/sync/hlc.dart; both are checked
 * against packages/shared/test-vectors/hlc.json.
 *
 *   2026-11-09T10:00:00.000Z-000A-node-1
 */
export interface Hlc {
  /** Milliseconds since the Unix epoch. */
  time: number;
  counter: number;
  node: string;
}

export const MAX_COUNTER = 0xffff;
/** Remote clocks further ahead than this are rejected (SRS §4.3.1). */
export const MAX_DRIFT_MS = 24 * 60 * 60 * 1000;

export class ClockDriftError extends Error {
  constructor(public readonly remote: string) {
    super(`Remote clock is too far ahead: ${remote}`);
  }
}

export function formatHlc(h: Hlc): string {
  return `${new Date(h.time).toISOString()}-${h.counter.toString(16).toUpperCase().padStart(4, "0")}-${h.node}`;
}

const HLC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-[0-9A-F]{4}-.+$/;

export function isHlc(s: string): boolean {
  return HLC_RE.test(s) && !Number.isNaN(Date.parse(s.slice(0, 24)));
}

export function parseHlc(s: string): Hlc {
  if (!isHlc(s)) throw new Error(`Not an HLC: ${s}`);
  return { time: Date.parse(s.slice(0, 24)), counter: parseInt(s.slice(25, 29), 16), node: s.slice(30) };
}

/** Clock value for a local event. */
export function sendHlc(clock: Hlc, nowMs: number): Hlc {
  if (nowMs > clock.time) return { time: nowMs, counter: 0, node: clock.node };
  if (clock.counter >= MAX_COUNTER) return { time: clock.time + 1, counter: 0, node: clock.node };
  return { time: clock.time, counter: clock.counter + 1, node: clock.node };
}

/** Clock value after seeing `remote`, so later local events sort after it. Throws if `remote` is too far ahead. */
export function receiveHlc(clock: Hlc, remote: Hlc, nowMs: number): Hlc {
  if (remote.time > nowMs + MAX_DRIFT_MS) throw new ClockDriftError(formatHlc(remote));
  let { time, counter } = clock;
  if (remote.time > time || (remote.time === time && remote.counter > counter)) {
    time = remote.time;
    counter = remote.counter;
  }
  if (nowMs > time) return { time: nowMs, counter: 0, node: clock.node };
  return counter >= MAX_COUNTER
    ? { time: time + 1, counter: 0, node: clock.node }
    : { time, counter: counter + 1, node: clock.node };
}

/** True when `incoming` should replace `existing` (per-record last-write-wins; equal HLCs change nothing). */
export function winsOver(incoming: string, existing: string | null | undefined): boolean {
  return !existing || incoming > existing;
}

/** The server's own clock. Each process has its own node id so two processes never mint equal values. */
const NODE = `server-${randomBytes(2).toString("hex")}`;
let last: Hlc = { time: 0, counter: 0, node: NODE };

/** A new HLC for a change made through the REST API, guaranteed to sort after `after` (the row's previous value). */
export function nextHlc(after?: string | null, nowMs = Date.now()): string {
  let next = sendHlc(last, nowMs);
  if (after && isHlc(after) && formatHlc(next) <= after) {
    const a = parseHlc(after);
    next =
      a.counter >= MAX_COUNTER
        ? { time: a.time + 1, counter: 0, node: NODE }
        : { time: a.time, counter: a.counter + 1, node: NODE };
  }
  last = next;
  return formatHlc(next);
}
