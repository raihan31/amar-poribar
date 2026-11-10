import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql as dsql } from "drizzle-orm";
import { createDb } from "../db.js";
import { runMigrations } from "../migrate.js";
import { EventBus } from "./bus.js";
import { drainOnce } from "./drain.js";
import { outbox, outboxDeliveries } from "./outbox.schema.js";
import { uuid7 } from "./uuid7.js";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe("uuid7", () => {
  it("is version 7 and sortable by creation time", () => {
    const ids = Array.from({ length: 50 }, () => uuid7());
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(50);
  });
});

describe.skipIf(!url)("event bus", () => {
  const dbName = `events_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = createDb({ databaseUrl: url ?? "", dbPoolMax: 2 });
  const u = new URL(url ?? "postgres://x");
  u.pathname = `/${dbName}`;
  const { db, sql, close } = createDb({ databaseUrl: u.toString(), dbPoolMax: 10 });
  let bus: EventBus;

  beforeAll(async () => {
    await admin.sql.unsafe(`create database ${dbName}`);
    await runMigrations(sql);
  });
  afterAll(async () => {
    await close();
    await admin.sql.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin.close();
  });
  beforeEach(async () => {
    await sql`delete from platform.outbox`;
    bus = new EventBus();
  });

  const row = async (id: string) => (await db.select().from(outbox).where(eq(outbox.id, id)))[0]!;
  const rewind = () => sql`update platform.outbox set next_attempt_at = now() where status = 'pending'`;

  it("publish writes outbox row in the callers transaction and rolls back with it", async () => {
    const committed = await db.transaction((tx) => bus.publish(tx, "t.Committed.v1", { a: 1 }, { familyId: uuid7() }));
    const saved = await row(committed.id);
    expect(saved).toMatchObject({ name: "t.Committed.v1", payload: { a: 1 }, status: "pending", attempts: 0 });
    expect(saved.familyId).not.toBeNull();

    let rolledBackId = "";
    await expect(
      db.transaction(async (tx) => {
        rolledBackId = (await bus.publish(tx, "t.RolledBack.v1", {})).id;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.select().from(outbox).where(eq(outbox.id, rolledBackId))).toHaveLength(0);
  });

  it("in-tx subscriber failure rolls back the publisher", async () => {
    await sql`create table if not exists platform.scratch (id int)`;
    bus.onInTx("t.Created.v1", () => {
      throw new Error("invariant");
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(dsql`insert into platform.scratch values (1)`);
        await bus.publish(tx, "t.Created.v1", {});
      }),
    ).rejects.toThrow("invariant");
    expect(await db.select().from(outbox)).toHaveLength(0);
    const rows = await sql`select count(*)::int as n from platform.scratch`;
    expect(rows[0]!.n).toBe(0);
  });

  it("durable subscribers each receive the event once", async () => {
    const calls: string[] = [];
    bus.on("t.Created.v1", "a", (e) => void calls.push(`a:${e.id}`));
    bus.on("t.Created.v1", "b", (e) => void calls.push(`b:${e.id}`));
    const ev = await db.transaction((tx) => bus.publish(tx, "t.Created.v1", { x: 1 }));
    const r = await drainOnce(db, bus);
    expect(r).toMatchObject({ processed: 1, done: 1 });
    await drainOnce(db, bus);
    expect(calls.sort()).toEqual([`a:${ev.id}`, `b:${ev.id}`]);
    expect((await row(ev.id)).status).toBe("done");
  });

  it("failing handler retries with backoff and others are not repeated", async () => {
    let good = 0;
    let bad = 0;
    bus.on("t.Created.v1", "good", () => void (good += 1));
    bus.on("t.Created.v1", "flaky", () => {
      bad += 1;
      if (bad < 3) throw new Error(`fail ${bad}`);
    });
    const ev = await db.transaction((tx) => bus.publish(tx, "t.Created.v1", {}));

    await drainOnce(db, bus);
    let r = await row(ev.id);
    expect(r.status).toBe("pending");
    expect(r.attempts).toBe(1);
    expect(r.lastError).toContain("fail 1");
    const delay1 = (
      await sql`select extract(epoch from next_attempt_at - now())::float as s from platform.outbox where id = ${ev.id}`
    )[0]!.s as number;
    expect(delay1).toBeGreaterThan(0.5);
    expect(delay1).toBeLessThanOrEqual(2);

    // not due yet: nothing happens
    expect((await drainOnce(db, bus)).processed).toBe(0);

    await rewind();
    await drainOnce(db, bus);
    r = await row(ev.id);
    expect(r.attempts).toBe(2);
    const delay2 = (
      await sql`select extract(epoch from next_attempt_at - now())::float as s from platform.outbox where id = ${ev.id}`
    )[0]!.s as number;
    expect(delay2).toBeGreaterThan(2.5);
    expect(delay2).toBeLessThanOrEqual(4);

    await rewind();
    await drainOnce(db, bus);
    r = await row(ev.id);
    expect(r.status).toBe("done");
    expect(good).toBe(1);
    expect(bad).toBe(3);
    const d = await db.select().from(outboxDeliveries).where(eq(outboxDeliveries.eventId, ev.id));
    expect(d.find((x) => x.handler === "flaky")).toMatchObject({ status: "done", attempts: 3 });
  });

  it("event moves to dead after 10 attempts", async () => {
    bus.on("t.Created.v1", "always", () => {
      throw new Error("nope");
    });
    const ev = await db.transaction((tx) => bus.publish(tx, "t.Created.v1", {}));
    for (let i = 0; i < 10; i++) {
      await rewind();
      await drainOnce(db, bus);
    }
    const r = await row(ev.id);
    expect(r.status).toBe("dead");
    expect(r.attempts).toBe(10);
    expect(r.lastError).toContain("nope");
    await rewind();
    expect((await drainOnce(db, bus)).processed).toBe(0);
  });

  it("drain is safe with two concurrent drainers", async () => {
    const seen = new Map<string, number>();
    bus.on("t.Created.v1", "count", async (e) => {
      await new Promise((r) => setTimeout(r, 20));
      seen.set(e.id, (seen.get(e.id) ?? 0) + 1);
    });
    for (let i = 0; i < 12; i++) await db.transaction((tx) => bus.publish(tx, "t.Created.v1", { i }));
    const [a, b] = await Promise.all([drainOnce(db, bus, 6), drainOnce(db, bus, 6)]);
    expect(a.processed + b.processed).toBe(12);
    expect(seen.size).toBe(12);
    for (const n of seen.values()) expect(n).toBe(1);
  });

  it("publishInProcess is not persisted", async () => {
    const got: unknown[] = [];
    bus.onInProcess("t.Signal.v1", (_n, p) => got.push(p));
    bus.publishInProcess("t.Signal.v1", { z: 1 });
    expect(got).toEqual([{ z: 1 }]);
    expect(await db.select().from(outbox)).toHaveLength(0);
  });
});
