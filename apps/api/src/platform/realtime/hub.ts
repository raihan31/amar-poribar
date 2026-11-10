import type { WebSocket } from "ws";
import type { EventBus } from "../events/bus.js";
import { uuid7 } from "../events/uuid7.js";
import type { Fanout } from "./fanout.js";
import {
  AUTH_TIMEOUT_MS,
  CLOSE,
  FrameError,
  PING_TIMEOUT_MS,
  RATE_LIMIT,
  type ClientIdentity,
  type FanoutMessage,
  type Frame,
  type FrameHandler,
  type FrameInput,
} from "./protocol.js";

export interface Connection extends ClientIdentity {
  socket: WebSocket;
  lastPingAt: number;
}

export interface HubOptions {
  /** Identity's `verifyAccessToken`; may throw for an invalid token. */
  verifyAccessToken: (token: string) => { userId: string } | Promise<{ userId: string }>;
  /** Optional membership check run after the token is verified. */
  isMember?: (userId: string, familyId: string) => boolean | Promise<boolean>;
  fanout: Fanout;
  /** When given, the hub drops sockets on `families.MemberRemoved.v1` and `families.FamilySuspended.v1`. */
  bus?: EventBus;
  authTimeoutMs?: number;
  pingTimeoutMs?: number;
  sweepIntervalMs?: number;
  rateLimit?: { frames: number; windowMs: number };
  now?: () => number;
  onError?: (err: unknown) => void;
}

const OPEN = 1;
const SEEN_LIMIT = 2_000;

export class Hub {
  readonly instanceId = uuid7();
  private readonly byUser = new Map<string, Set<Connection>>();
  private readonly byFamily = new Map<string, Set<string>>();
  private readonly handlers = new Map<string, FrameHandler[]>();
  private readonly seen = new Set<string>();
  private readonly o: Required<Omit<HubOptions, "bus" | "isMember">> & Pick<HubOptions, "bus" | "isMember">;
  private sweeper: NodeJS.Timeout | undefined;
  private started = false;

  constructor(opts: HubOptions) {
    this.o = {
      authTimeoutMs: AUTH_TIMEOUT_MS,
      pingTimeoutMs: PING_TIMEOUT_MS,
      sweepIntervalMs: 5_000,
      rateLimit: RATE_LIMIT,
      now: Date.now,
      onError: () => {},
      ...opts,
    };
  }

  // ----- lifecycle -----

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.o.fanout.start((msg) => this.onFanout(msg));
    this.sweeper = setInterval(() => this.sweep(), this.o.sweepIntervalMs);
    this.sweeper.unref();
    const bus = this.o.bus;
    if (bus) {
      bus.on("families.MemberRemoved.v1", "realtime.hub", async (e) => {
        const p = e.payload as { familyId?: string; userId?: string } | undefined;
        if (p?.familyId && p.userId) await this.closeMember(p.familyId, p.userId);
      });
      bus.on("families.FamilySuspended.v1", "realtime.hub", async (e) => {
        const p = e.payload as { familyId?: string } | undefined;
        if (p?.familyId) await this.dropFamily(p.familyId);
      });
    }
  }

  async stop(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = undefined;
    for (const set of [...this.byUser.values()]) for (const c of [...set]) c.socket.terminate();
    this.byUser.clear();
    this.byFamily.clear();
    this.started = false;
    await this.o.fanout.stop();
  }

  // ----- public API used by modules (ctx.realtime) -----

  async sendToUser(userId: string, input: FrameInput): Promise<Frame> {
    const frame = this.stamp(input);
    this.seen.add(frame.id);
    this.deliverToUser(userId, frame);
    await this.publish({ kind: "user", origin: this.instanceId, userId, frame });
    return frame;
  }

  async sendToFamily(familyId: string, input: FrameInput, opts: { exceptUserId?: string } = {}): Promise<Frame> {
    const frame = this.stamp(input);
    this.seen.add(frame.id);
    this.deliverToFamily(familyId, frame, opts.exceptUserId);
    await this.publish({
      kind: "family",
      origin: this.instanceId,
      familyId,
      ...(opts.exceptUserId ? { exceptUserId: opts.exceptUserId } : {}),
      frame,
    });
    return frame;
  }

  /** True when the user has a socket on THIS instance. */
  isOnline(userId: string): boolean {
    return (this.byUser.get(userId)?.size ?? 0) > 0;
  }

  /** Users of the family with a socket on THIS instance. */
  onlineUsers(familyId: string): string[] {
    return [...(this.byFamily.get(familyId) ?? [])];
  }

  /** Closes every socket of the user, on every instance. */
  async closeUser(userId: string, code: number): Promise<void> {
    this.closeLocal(userId, code);
    await this.publish({ kind: "close", origin: this.instanceId, userId, code });
  }

  /** Registers a handler for a client-to-server frame type. Unknown types are ignored. */
  subscribe(type: string, handler: FrameHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  // ----- authorisation re-check -----

  async closeMember(familyId: string, userId: string): Promise<void> {
    this.closeLocal(userId, CLOSE.removed, familyId);
    await this.publish({ kind: "close", origin: this.instanceId, userId, code: CLOSE.removed, familyId });
  }

  async dropFamily(familyId: string): Promise<void> {
    this.dropFamilyLocal(familyId, CLOSE.removed);
    await this.publish({ kind: "dropFamily", origin: this.instanceId, familyId, code: CLOSE.removed });
  }

  // ----- connections -----

  /** Takes over a freshly accepted socket: waits for the auth frame, then serves it. */
  attach(socket: WebSocket): void {
    let conn: Connection | undefined;
    const rate = this.o.rateLimit;
    let windowStart = this.o.now();
    let count = 0;

    const authTimer = setTimeout(() => socket.close(CLOSE.unauthorised, "auth timeout"), this.o.authTimeoutMs);
    let queue: Promise<void> = Promise.resolve();

    socket.on("message", (data, isBinary) => {
      const now = this.o.now();
      if (now - windowStart >= rate.windowMs) {
        windowStart = now;
        count = 0;
      }
      if (++count > rate.frames) {
        socket.close(CLOSE.rateLimited, "rate limit");
        return;
      }
      if (isBinary) return;
      const text = rawToString(data);
      queue = queue
        .then(async () => {
          if (socket.readyState !== OPEN) return;
          const frame = parseFrame(text);
          if (!frame) {
            if (!conn) socket.close(CLOSE.unauthorised, "auth required");
            return;
          }
          if (!conn) {
            conn = await this.authenticate(socket, frame);
            if (conn) clearTimeout(authTimer);
            return;
          }
          await this.handle(conn, frame);
        })
        .catch((err) => this.o.onError(err));
    });
    socket.on("close", () => {
      clearTimeout(authTimer);
      if (conn) this.removeConnection(conn);
    });
    socket.on("error", (err) => this.o.onError(err));
  }

  private async authenticate(socket: WebSocket, frame: Frame): Promise<Connection | undefined> {
    const { token, deviceId, familyId } = frame;
    if (
      frame.t !== "auth" ||
      typeof token !== "string" ||
      typeof deviceId !== "string" ||
      typeof familyId !== "string"
    ) {
      socket.close(CLOSE.unauthorised, "auth required");
      return undefined;
    }
    let userId: string;
    try {
      userId = (await this.o.verifyAccessToken(token)).userId;
    } catch {
      socket.close(CLOSE.unauthorised, "unauthorised");
      return undefined;
    }
    if (this.o.isMember && !(await this.o.isMember(userId, familyId))) {
      socket.close(CLOSE.removed, "not a member");
      return undefined;
    }
    if (socket.readyState !== OPEN) return undefined;
    const conn: Connection = { socket, userId, deviceId, familyId, lastPingAt: this.o.now() };
    this.addConnection(conn);
    this.sendRaw(socket, { t: "ack", id: frame.id, ts: new Date().toISOString() });
    return conn;
  }

  private async handle(conn: Connection, frame: Frame): Promise<void> {
    conn.lastPingAt = this.o.now();
    switch (frame.t) {
      case "ping":
        this.sendRaw(conn.socket, this.stamp({ t: "pong" }));
        return;
      case "auth.refresh": {
        try {
          const r = await this.o.verifyAccessToken(String(frame.token));
          if (r.userId !== conn.userId) throw new Error("user mismatch");
        } catch {
          conn.socket.close(CLOSE.unauthorised, "unauthorised");
          return;
        }
        this.sendRaw(conn.socket, { t: "ack", id: frame.id, ts: new Date().toISOString() });
        return;
      }
      default:
    }
    const list = this.handlers.get(frame.t);
    if (!list?.length) return;
    try {
      for (const h of list) await h({ userId: conn.userId, deviceId: conn.deviceId, familyId: conn.familyId }, frame);
      this.sendRaw(conn.socket, { t: "ack", id: frame.id, ts: new Date().toISOString() });
    } catch (e) {
      const code = e instanceof FrameError ? e.code : "internal_error";
      if (!(e instanceof FrameError)) this.o.onError(e);
      this.sendRaw(conn.socket, { t: "err", id: frame.id, ts: new Date().toISOString(), code });
    }
  }

  private addConnection(conn: Connection): void {
    let set = this.byUser.get(conn.userId);
    const first = !set || set.size === 0;
    if (!set) this.byUser.set(conn.userId, (set = new Set()));
    set.add(conn);
    let fam = this.byFamily.get(conn.familyId);
    if (!fam) this.byFamily.set(conn.familyId, (fam = new Set()));
    fam.add(conn.userId);
    if (first) this.announce(conn.userId, conn.familyId, true);
  }

  private removeConnection(conn: Connection): void {
    const set = this.byUser.get(conn.userId);
    if (!set?.delete(conn)) return;
    const stillInFamily = [...set].some((c) => c.familyId === conn.familyId);
    if (!stillInFamily) {
      const fam = this.byFamily.get(conn.familyId);
      fam?.delete(conn.userId);
      if (fam?.size === 0) this.byFamily.delete(conn.familyId);
    }
    if (set.size === 0) {
      this.byUser.delete(conn.userId);
      this.announce(conn.userId, conn.familyId, false);
    }
  }

  private announce(userId: string, familyId: string, online: boolean): void {
    this.o.bus?.publishInProcess("realtime.presence", { userId, familyId, online });
    this.sendToFamily(familyId, { t: "presence", userId, online }, { exceptUserId: userId }).catch(this.o.onError);
  }

  private sweep(): void {
    const cutoff = this.o.now() - this.o.pingTimeoutMs;
    for (const set of [...this.byUser.values()]) {
      for (const c of [...set]) {
        if (c.lastPingAt < cutoff) {
          this.removeConnection(c);
          c.socket.terminate();
        }
      }
    }
  }

  // ----- delivery -----

  private stamp(input: FrameInput): Frame {
    return { ...input, id: input.id ?? uuid7(), ts: input.ts ?? new Date().toISOString() };
  }

  private sendRaw(socket: WebSocket, frame: Record<string, unknown>): void {
    if (socket.readyState === OPEN) socket.send(JSON.stringify(frame));
  }

  private deliverToUser(userId: string, frame: Frame): void {
    for (const c of this.byUser.get(userId) ?? []) this.sendRaw(c.socket, frame);
  }

  private deliverToFamily(familyId: string, frame: Frame, exceptUserId?: string): void {
    for (const userId of this.byFamily.get(familyId) ?? []) {
      if (userId === exceptUserId) continue;
      for (const c of this.byUser.get(userId) ?? []) if (c.familyId === familyId) this.sendRaw(c.socket, frame);
    }
  }

  private closeLocal(userId: string, code: number, familyId?: string): void {
    for (const c of [...(this.byUser.get(userId) ?? [])]) {
      if (familyId && c.familyId !== familyId) continue;
      this.removeConnection(c);
      c.socket.close(code, "closed by server");
    }
  }

  private dropFamilyLocal(familyId: string, code: number): void {
    for (const userId of [...(this.byFamily.get(familyId) ?? [])]) this.closeLocal(userId, code, familyId);
  }

  private async publish(msg: FanoutMessage): Promise<void> {
    try {
      await this.o.fanout.publish(msg);
    } catch (e) {
      this.o.onError(e);
    }
  }

  private onFanout(msg: FanoutMessage): void {
    if (msg.origin === this.instanceId) return;
    if (msg.kind === "user" || msg.kind === "family") {
      if (this.seen.has(msg.frame.id)) return;
      this.seen.add(msg.frame.id);
      if (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value as string);
    }
    switch (msg.kind) {
      case "user":
        this.deliverToUser(msg.userId, msg.frame);
        return;
      case "family":
        this.deliverToFamily(msg.familyId, msg.frame, msg.exceptUserId);
        return;
      case "close":
        this.closeLocal(msg.userId, msg.code, msg.familyId);
        return;
      case "dropFamily":
        this.dropFamilyLocal(msg.familyId, msg.code);
    }
  }
}

function rawToString(data: Buffer | ArrayBuffer | Buffer[]): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data as ArrayBuffer).toString("utf8");
}

function parseFrame(text: string): Frame | undefined {
  try {
    const v: unknown = JSON.parse(text);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
    const o = v as Record<string, unknown>;
    if (typeof o.t !== "string") return undefined;
    return {
      ...o,
      t: o.t,
      id: typeof o.id === "string" ? o.id : "",
      ts: typeof o.ts === "string" ? o.ts : new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}
