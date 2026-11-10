import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createDb } from "../db.js";
import { runMigrations } from "../migrate.js";
import { EventBus } from "../events/bus.js";
import { defineJob } from "./define.js";
import { createJobs, type Jobs } from "./jobs.js";
import { findOrphans, platformJobs, startOutboxLoop } from "./platform-jobs.js";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

async function until(cond: () => boolean | Promise<boolean>, ms = 20_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("timed out waiting for condition");
}

describe.skipIf(!url)("pg-boss jobs", () => {
  const dbName = `jobs_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = createDb({ databaseUrl: url ?? "", dbPoolMax: 2 });
  const u = new URL(url ?? "postgres://x");
  u.pathname = `/${dbName}`;
  const { db, sql, close } = createDb({ databaseUrl: u.toString(), dbPoolMax: 10 });
  const started: Jobs[] = [];

  const make = () => {
    const j = createJobs({ databaseUrl: u.toString(), role: "worker" }, sql);
    started.push(j);
    return j;
  };

  beforeAll(async () => {
    await admin.sql.unsafe(`create database ${dbName}`);
    await runMigrations(sql);
  });
  afterAll(async () => {
    for (const j of started) await j.stop();
    await close();
    await admin.sql.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin.close();
  });

  it("send then work executes once", async () => {
    const jobs = make();
    const got: string[] = [];
    jobs.register(
      defineJob({ name: "t.echo-value", schema: z.object({ v: z.string() }), handler: (d) => void got.push(d.v) }),
    );
    await jobs.start();
    await jobs.send("t.echo-value", { v: "hello" });
    await until(() => got.length > 0);
    await new Promise((r) => setTimeout(r, 1500));
    expect(got).toEqual(["hello"]);
  });

  it("failed job retries with backoff then becomes dead", async () => {
    const jobs = make();
    const times: number[] = [];
    jobs.register(
      defineJob({
        name: "t.always-fail",
        schema: z.object({}),
        retryLimit: 2,
        retryDelay: 1,
        handler: () => {
          times.push(Date.now());
          throw new Error("boom");
        },
      }),
    );
    await jobs.start();
    const before = await jobs.deadLetterCount();
    await jobs.send("t.always-fail", {});
    await until(async () => times.length >= 3 && (await jobs.deadLetterCount()) > before);
    expect(times).toHaveLength(3);
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(900);
    expect(times[2]! - times[1]!).toBeGreaterThan(times[1]! - times[0]!);
  });

  it("platform jobs: cleanup, integrity check and dead-letter report", async () => {
    const jobs = make();
    const metrics: Record<string, number> = {};
    const defs = platformJobs({ db, sql, bus: new EventBus(), jobs, onMetric: (n, v) => (metrics[n] = v) });
    expect(defs.map((d) => d.name)).toEqual([
      "platform.outbox.drain",
      "platform.outbox.cleanup",
      "platform.integrity.check",
      "platform.jobs.deadletter-report",
    ]);
    const run = (n: string) => defs.find((d) => d.name === n)!.handler({}, { attempt: 1 });
    await sql`insert into platform.outbox (id, name, payload, status, occurred_at)
              values (gen_random_uuid(), 't.Old.v1', '{}', 'done', now() - interval '8 days'),
                     (gen_random_uuid(), 't.New.v1', '{}', 'done', now())`;
    await run("platform.outbox.cleanup");
    expect(await sql`select 1 from platform.outbox where name = 't.Old.v1'`).toHaveLength(0);
    expect(await sql`select 1 from platform.outbox where name = 't.New.v1'`).toHaveLength(1);
    await run("platform.integrity.check");
    const [row] = await sql`select status, details from platform.health_checks where name = 'integrity'`;
    expect(row?.status).toBe("ok");
    expect(await findOrphans(sql)).toMatchObject({ platform: 0 });
    await run("platform.jobs.deadletter-report");
    expect(metrics.jobs_dead_letters).toBeGreaterThanOrEqual(1);
  });

  it("outbox loop drains a published event promptly via NOTIFY", async () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.on("t.Pinged.v1", "h", (e) => void seen.push(e.id));
    const stop = await startOutboxLoop({ db, sql, bus }, 60_000);
    try {
      const ev = await db.transaction((tx) => bus.publish(tx, "t.Pinged.v1", {}));
      await until(() => seen.includes(ev.id), 5000);
    } finally {
      await stop();
    }
  });
});
