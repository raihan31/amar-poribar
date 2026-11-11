import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createDb } from "../db.js";
import { EventBus } from "../events/bus.js";
import { drainOnce } from "../events/drain.js";
import { runMigrations } from "../migrate.js";
import { PgFanout } from "./fanout.js";
import { Hub, type HubOptions } from "./hub.js";
import { realtimePlugin } from "./plugin.js";
import { AUTH_TIMEOUT_MS, CLOSE, type Frame } from "./protocol.js";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const FAMILY = "fam-1";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Tokens are `tok:<userId>`; anything else is rejected. */
const verifyAccessToken = (token: string) => {
  if (!token.startsWith("tok:")) throw new Error("bad token");
  return { userId: token.slice(4) };
};

class Client {
  readonly frames: Frame[] = [];
  closed: Promise<number>;
  constructor(readonly ws: WebSocket) {
    ws.on("message", (d) => this.frames.push(JSON.parse((d as Buffer).toString("utf8")) as Frame));
    this.closed = new Promise((resolve) => ws.on("close", (code) => resolve(code)));
  }
  send(o: unknown) {
    this.ws.send(JSON.stringify(o));
  }
  async waitFor(t: string, timeoutMs = 3000): Promise<Frame> {
    const start = Date.now();
    for (;;) {
      const f = this.frames.find((x) => x.t === t);
      if (f) return f;
      if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${t}`);
      await sleep(15);
    }
  }
}

describe.skipIf(!url)("realtime hub", () => {
  const dbName = `realtime_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = createDb({ databaseUrl: url ?? "", dbPoolMax: 2 });
  const u = new URL(url ?? "postgres://x");
  u.pathname = `/${dbName}`;
  const dbs: ReturnType<typeof createDb>[] = [];
  const apps: FastifyInstance[] = [];
  const clients: Client[] = [];

  beforeAll(async () => {
    await admin.sql.unsafe(`create database ${dbName}`);
    const m = createDb({ databaseUrl: u.toString(), dbPoolMax: 4 });
    await runMigrations(m.sql);
    await m.close();
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.ws.terminate();
    for (const a of apps.splice(0)) await a.close();
    for (const d of dbs.splice(0)) await d.close();
  });
  afterAll(async () => {
    await admin.sql.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin.close();
  });

  async function instance(opts: Partial<HubOptions> = {}) {
    const d = createDb({ databaseUrl: u.toString(), dbPoolMax: 4 });
    dbs.push(d);
    const hub = new Hub({ verifyAccessToken, fanout: new PgFanout(d.sql), ...opts });
    const app = Fastify();
    await app.register(realtimePlugin, { hub });
    await app.listen({ port: 0, host: "127.0.0.1" });
    apps.push(app);
    const port = (app.server.address() as { port: number }).port;
    return { hub, app, port, db: d };
  }

  async function connect(port: number, user?: string, familyId = FAMILY): Promise<Client> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/ws`);
    const c = new Client(ws);
    clients.push(c);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    if (user) {
      c.send({ t: "auth", id: "a1", token: `tok:${user}`, deviceId: `dev-${user}`, familyId });
      await c.waitFor("ack");
    }
    return c;
  }

  it("rejects connection without auth frame in 5 seconds", async () => {
    expect(AUTH_TIMEOUT_MS).toBe(5000);
    const { port } = await instance({ authTimeoutMs: 250 });
    const c = await connect(port);
    expect(await c.closed).toBe(CLOSE.unauthorised);
  });

  it("rejects a bad token", async () => {
    const { port } = await instance();
    const c = await connect(port);
    c.send({ t: "auth", token: "nope", deviceId: "d", familyId: FAMILY });
    expect(await c.closed).toBe(CLOSE.unauthorised);
  });

  it("valid auth then ping gets pong", async () => {
    const { port, hub } = await instance();
    const c = await connect(port, "u1");
    expect(hub.isOnline("u1")).toBe(true);
    c.send({ t: "ping" });
    const pong = await c.waitFor("pong");
    expect(pong.id).toBeTruthy();
    expect(pong.ts).toBeTruthy();
  });

  it("sendToUser reaches all of the users sockets", async () => {
    const { port, hub } = await instance();
    const a = await connect(port, "u1");
    const b = await connect(port, "u1");
    const other = await connect(port, "u2");
    await hub.sendToUser("u1", { t: "nudge", nudgeId: "n1" });
    expect((await a.waitFor("nudge")).nudgeId).toBe("n1");
    expect((await b.waitFor("nudge")).nudgeId).toBe("n1");
    await sleep(100);
    expect(other.frames.find((f) => f.t === "nudge")).toBeUndefined();
  });

  it("message from another instance arrives through NOTIFY", async () => {
    const one = await instance();
    const two = await instance();
    const c = await connect(two.port, "u1");
    const sender = await connect(one.port, "u2");
    await one.hub.sendToUser("u1", { t: "msg", body: "hi" });
    expect((await c.waitFor("msg")).body).toBe("hi");

    await one.hub.sendToFamily(FAMILY, { t: "shopping.item", item: "rice" }, { exceptUserId: "u2" });
    expect((await c.waitFor("shopping.item")).item).toBe("rice");
    await sleep(100);
    expect(sender.frames.find((f) => f.t === "shopping.item")).toBeUndefined();
  });

  it("frames over the NOTIFY limit cross instances through realtime_payloads", async () => {
    const one = await instance();
    const two = await instance();
    const c = await connect(two.port, "u1");
    const big = "x".repeat(9000);
    await one.hub.sendToUser("u1", { t: "msg", body: big });
    expect((await c.waitFor("msg")).body).toBe(big);
  });

  it("closing last socket emits offline presence", async () => {
    const bus = new EventBus();
    const signals: unknown[] = [];
    bus.onInProcess("realtime.presence", (_n, p) => signals.push(p));
    const { port, hub } = await instance({ bus });
    const watcher = await connect(port, "u2");
    const a = await connect(port, "u1");
    const b = await connect(port, "u1");
    expect((await watcher.waitFor("presence")).online).toBe(true);
    a.ws.close();
    await a.closed;
    await sleep(100);
    expect(hub.isOnline("u1")).toBe(true);
    expect(signals).toEqual([
      { userId: "u2", familyId: FAMILY, online: true },
      { userId: "u1", familyId: FAMILY, online: true },
    ]);
    b.ws.close();
    await b.closed;
    const deadline = Date.now() + 3000;
    while (watcher.frames.filter((f) => f.t === "presence").length < 2 && Date.now() < deadline) await sleep(15);
    const last = watcher.frames.filter((f) => f.t === "presence").at(-1)!;
    expect(last).toMatchObject({ userId: "u1", online: false });
    expect(hub.isOnline("u1")).toBe(false);
    expect(signals.at(-1)).toEqual({ userId: "u1", familyId: FAMILY, online: false });
  });

  it("removed member is disconnected", async () => {
    const bus = new EventBus();
    const one = await instance({ bus });
    const two = await instance();
    const c = await connect(two.port, "u1");
    const keep = await connect(one.port, "u2");
    await one.db.db.transaction((tx) =>
      bus.publish(tx, "families.MemberRemoved.v1", { familyId: FAMILY, userId: "u1" }),
    );
    await drainOnce(one.db.db, bus);
    expect(await c.closed).toBe(CLOSE.removed);
    expect(keep.ws.readyState).toBe(WebSocket.OPEN);
    expect(two.hub.isOnline("u1")).toBe(false);
  });

  it("suspended family is disconnected", async () => {
    const bus = new EventBus();
    const one = await instance({ bus });
    const c = await connect(one.port, "u1");
    await one.db.db.transaction((tx) =>
      bus.publish(tx, "families.FamilySuspended.v1", { familyId: FAMILY, reason: "test" }),
    );
    await drainOnce(one.db.db, bus);
    expect(await c.closed).toBe(CLOSE.removed);
  });

  it("frame over 16KB closes the socket", async () => {
    const { port } = await instance();
    const c = await connect(port, "u1");
    c.send({ t: "typing", pad: "x".repeat(17 * 1024) });
    expect(await c.closed).toBe(CLOSE.tooBig);
  });

  it("more than 60 frames in 10 seconds closes with 4429", async () => {
    const { port } = await instance();
    const c = await connect(port, "u1");
    for (let i = 0; i < 70; i++) c.send({ t: "ping" });
    expect(await c.closed).toBe(CLOSE.rateLimited);
  });

  it("subscribed handlers get acked or answered with err; unknown types are ignored", async () => {
    const { port, hub } = await instance();
    const seen: string[] = [];
    hub.subscribe("typing", (who, f) => void seen.push(`${who.userId}:${f.id}`));
    hub.subscribe("msg.read", () => {
      throw new Error("boom");
    });
    const c = await connect(port, "u1");
    c.send({ t: "typing", id: "c1" });
    c.send({ t: "msg.read", id: "c2" });
    c.send({ t: "who.knows", id: "c3" });
    await sleep(300);
    expect(seen).toEqual(["u1:c1"]);
    expect(c.frames.filter((f) => f.id === "c1")[0]).toMatchObject({ t: "ack" });
    expect(c.frames.filter((f) => f.id === "c2")[0]).toMatchObject({ t: "err", code: "internal_error" });
    expect(c.frames.some((f) => f.id === "c3")).toBe(false);
  });

  it("socket without ping for the timeout is closed and marked offline", async () => {
    const { port, hub } = await instance({ pingTimeoutMs: 200, sweepIntervalMs: 50 });
    const c = await connect(port, "u1");
    await c.closed;
    expect(hub.isOnline("u1")).toBe(false);
  });
});
