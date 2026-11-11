import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type OwnedTestDb } from "../../../../tests/support/db-test.js";
import { FakePushSender } from "../infra/fake-sender.js";
import { readPreferences, updatePreferences } from "./preferences.js";
import { createNotifier, type NotifierHub, type PushTarget } from "./notifier.js";

let t: OwnedTestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.drop();
});

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
// 06:00 UTC is 12:00 in Dhaka (not quiet); 18:00 UTC is 00:00 in Dhaka (quiet).
const NOON = new Date("2026-01-15T06:00:00.000Z");
const MIDNIGHT = new Date("2026-01-15T18:00:00.000Z");

class FakeHub implements NotifierHub {
  online = new Set<string>();
  frames: { userId: string; frame: Record<string, unknown> }[] = [];
  isOnline(userId: string) {
    return this.online.has(userId);
  }
  async sendToUser(userId: string, frame: Record<string, unknown>) {
    this.frames.push({ userId, frame });
  }
}

function setup(now: Date = NOON) {
  const sender = new FakePushSender(() => now);
  const hub = new FakeHub();
  const removed: string[] = [];
  const targets: PushTarget[] = [];
  const jobsSent: { name: string; data: unknown; opts: unknown }[] = [];
  const notifier = createNotifier({
    db: t.db,
    sender,
    hub,
    jobs: {
      send: async (name, data, opts) => {
        jobsSent.push({ name, data, opts });
        return "id";
      },
    },
    clock: () => now,
    getPreferences: (id) => readPreferences(t.db, id),
    identity: {
      getProfile: async () => ({ name: "X", locale: "bn", numeralStyle: "bn", simpleMode: false }),
      listPushTargets: async (ids) => targets.filter((x) => ids.includes(x.userId)),
      removeDeviceToken: async (token) => {
        removed.push(token);
      },
    },
  });
  return { notifier, sender, hub, removed, targets, jobsSent };
}

const target = (userId: string, n = 1): PushTarget => ({
  userId,
  deviceId: `dev-${userId.slice(0, 2)}-${n}`,
  platform: "android",
  fcmToken: `tok-${userId.slice(0, 2)}-${n}`,
  locale: "bn",
});

const input = (extra: Record<string, unknown> = {}) => ({
  userIds: [U1],
  kind: "system" as const,
  params: { text: "hello" },
  ...extra,
});

const NUDGE = { kind: "nudge" as const, params: { sender: "মা", phrase: "খেয়েছ?" } };

const inboxCount = async (userId = U1) =>
  Number((await t.sql`select count(*)::int as n from notifications.inbox_items where user_id = ${userId}`)[0]?.n);

beforeEach(async () => {
  await t.truncateAll();
});

describe("notify", () => {
  it("connected user gets socket frame and no push", async () => {
    const s = setup();
    s.hub.online.add(U1);
    s.targets.push(target(U1));
    const r = await s.notifier.notify(input());
    expect(r.delivered).toEqual({ [U1]: "socket" });
    expect(s.hub.frames).toHaveLength(1);
    expect(s.hub.frames[0]?.frame).toMatchObject({ t: "inbox", item: { kind: "system" } });
    expect(s.sender.messages()).toHaveLength(0);
  });

  it("offline user gets push in fake sink with data only", async () => {
    const s = setup();
    s.targets.push(target(U1));
    const r = await s.notifier.notify(input({ push: { priority: "high", channel: "chat" } }));
    expect(r.delivered).toEqual({ [U1]: "push" });
    const [m] = s.sender.messages();
    expect(m).toMatchObject({ token: "tok-11-1", priority: "high", androidChannelId: "chat", ttlSeconds: 3600 });
    expect(m?.data).toMatchObject({ kind: "system", v: "1" });
    expect(m?.data.inboxId).toMatch(/^[0-9a-f-]{36}$/);
    expect(m).not.toHaveProperty("notification");
    expect(s.hub.frames).toHaveLength(0);
  });

  it("inbox row written in both cases", async () => {
    const s = setup();
    s.hub.online.add(U1);
    s.targets.push(target(U2));
    await s.notifier.notify(input({ userIds: [U1, U2] }));
    expect(await inboxCount(U1)).toBe(1);
    expect(await inboxCount(U2)).toBe(1);
  });

  it("skipInbox writes no row", async () => {
    const s = setup();
    s.targets.push(target(U1));
    await s.notifier.notify(input({ skipInbox: true }));
    expect(await inboxCount()).toBe(0);
    expect(s.sender.messages()).toHaveLength(1);
    expect(s.sender.messages()[0]?.data.inboxId).toBe("");
  });

  it("dedupeKey prevents second delivery", async () => {
    const s = setup();
    s.targets.push(target(U1));
    const first = await s.notifier.notify(input({ dedupeKey: "k1" }));
    const second = await s.notifier.notify(input({ dedupeKey: "k1" }));
    expect(first.delivered).toEqual({ [U1]: "push" });
    expect(second.delivered).toEqual({});
    expect(await inboxCount()).toBe(1);
    expect(s.sender.messages()).toHaveLength(1);
  });

  it("preference off writes inbox only", async () => {
    const s = setup();
    s.hub.online.add(U1);
    s.targets.push(target(U1));
    await updatePreferences(t.db, U1, { kinds: { nudge: false } });
    const r = await s.notifier.notify(input(NUDGE));
    expect(r.delivered).toEqual({ [U1]: "inbox_only" });
    expect(await inboxCount()).toBe(1);
    expect(s.hub.frames).toHaveLength(0);
    expect(s.sender.messages()).toHaveLength(0);
  });

  it("UNREGISTERED token removed via identity fake", async () => {
    const s = setup();
    s.targets.push(target(U1, 1), target(U1, 2));
    s.sender.failToken("tok-11-1", "UNREGISTERED");
    const r = await s.notifier.notify(input());
    expect(r.delivered).toEqual({ [U1]: "push" });
    expect(s.removed).toEqual(["tok-11-1"]);
    expect(s.sender.messages()).toHaveLength(1);
  });

  it("QUOTA failures enqueue one retry job", async () => {
    const s = setup();
    s.targets.push(target(U1));
    s.sender.failToken("tok-11-1", "QUOTA");
    await s.notifier.notify(input());
    expect(s.jobsSent).toHaveLength(1);
    expect(s.jobsSent[0]).toMatchObject({
      name: "notifications.retry-push",
      opts: { startAfter: 60, singletonKey: expect.stringContaining("dev-11-1") },
    });
    const spy = vi.spyOn(s.sender, "send");
    await s.notifier.retryJob.handler(s.jobsSent[0]?.data, { attempt: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(s.jobsSent).toHaveLength(1);
  });

  it("quiet hours downgrade priority and set quiet=1", async () => {
    const s = setup(MIDNIGHT);
    s.targets.push(target(U1));
    await s.notifier.notify(input({ ...NUDGE, push: { priority: "high", channel: "nudge" } }));
    const [m] = s.sender.messages();
    expect(m).toMatchObject({ priority: "normal", androidChannelId: "alerts" });
    expect(m?.data.quiet).toBe("1");
  });

  it("outside quiet hours keeps priority and channel", async () => {
    const s = setup(NOON);
    s.targets.push(target(U1));
    await s.notifier.notify(input({ ...NUDGE, push: { priority: "high", channel: "nudge" } }));
    expect(s.sender.messages()[0]).toMatchObject({ priority: "high", androidChannelId: "nudge" });
    expect(s.sender.messages()[0]?.data.quiet).toBe("0");
  });

  it("incoming call ignores quiet hours", async () => {
    const s = setup(MIDNIGHT);
    s.targets.push(target(U1));
    await s.notifier.notify(
      input({ kind: "call_incoming", params: { sender: "মা" }, push: { priority: "high", channel: "calls" } }),
    );
    expect(s.sender.messages()[0]).toMatchObject({ priority: "high", androidChannelId: "calls", ttlSeconds: 45 });
  });

  it("no targets gives inbox_only", async () => {
    const s = setup();
    const r = await s.notifier.notify(input());
    expect(r.delivered).toEqual({ [U1]: "inbox_only" });
    expect(await inboxCount()).toBe(1);
  });

  it("delivery_stats counted", async () => {
    const s = setup();
    s.hub.online.add(U1);
    s.targets.push(target(U2));
    await s.notifier.notify(input({ userIds: [U1, U2] }));
    await s.notifier.notify(input({ userIds: [U1] }));
    const rows = await t.sql<{ channel: string; kind: string; ok: number; failed: number }[]>`
      select channel, kind, ok, failed from notifications.delivery_stats order by channel`;
    expect(rows).toEqual([
      { channel: "push", kind: "system", ok: 1, failed: 0 },
      { channel: "socket", kind: "system", ok: 2, failed: 0 },
    ]);
  });

  it("failed push is counted as failed", async () => {
    const s = setup();
    s.targets.push(target(U1));
    s.sender.failToken("tok-11-1", "INVALID_ARGUMENT");
    await s.notifier.notify(input());
    const rows = await t.sql<{ ok: number; failed: number }[]>`
      select ok, failed from notifications.delivery_stats where channel = 'push'`;
    expect(rows).toEqual([{ ok: 0, failed: 1 }]);
  });
});
