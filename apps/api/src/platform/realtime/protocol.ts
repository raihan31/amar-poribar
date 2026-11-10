/** WebSocket protocol constants and envelope types (SRS §5.4). */

export const MAX_FRAME_BYTES = 16 * 1024;
export const AUTH_TIMEOUT_MS = 5_000;
export const PING_TIMEOUT_MS = 60_000;
export const RATE_LIMIT = { frames: 60, windowMs: 10_000 } as const;
/** NOTIFY payloads are capped at 8,000 bytes by PostgreSQL; stay below with headroom. */
export const NOTIFY_MAX_BYTES = 7_000;
export const NOTIFY_CHANNEL = "realtime";

export const CLOSE = {
  /** Bad or missing credentials, and (SRS §5.4) the 5-second auth window elapsing. */
  unauthorised: 4401,
  /** Liveness failure: no ping for 60 seconds. */
  timeout: 4408,
  rateLimited: 4429,
  removed: 4403,
  tooBig: 1009,
} as const;

/** Every frame carries these; the rest is payload. */
export interface Frame {
  t: string;
  id: string;
  ts: string;
  [key: string]: unknown;
}

/** What callers pass in; `id` and `ts` are filled when missing. */
export type FrameInput = { t: string; id?: string; ts?: string } & Record<string, unknown>;

export interface ClientIdentity {
  userId: string;
  deviceId: string;
  familyId: string;
}

/** Handler for a client-to-server frame. Resolve to acknowledge, throw `FrameError` to answer `err`. */
export type FrameHandler = (who: ClientIdentity, frame: Frame) => Promise<void> | void;

export class FrameError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Message exchanged between hub instances through LISTEN/NOTIFY. */
export type FanoutMessage =
  | { kind: "user"; origin: string; userId: string; frame: Frame }
  | { kind: "family"; origin: string; familyId: string; exceptUserId?: string; frame: Frame }
  | { kind: "close"; origin: string; userId: string; code: number; familyId?: string }
  | { kind: "dropFamily"; origin: string; familyId: string; code: number };
