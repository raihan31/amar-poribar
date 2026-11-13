import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { createDb } from "../db.js";
import { createJobs } from "../jobs/jobs.js";
import { runMigrations } from "../migrate.js";
import { createMetrics } from "./metrics.js";
import { registerHealth } from "./routes.js";
import { healthSampleJob } from "./health.js";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe.skipIf(!url)("health (database)", () => {
  const dbName = `health_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = createDb({ databaseUrl: url ?? "", dbPoolMax: 2 });
  const u = new URL(url ?? "postgres://x");
  u.pathname = `/${dbName}`;
  const conn = createDb({ databaseUrl: u.toString(), dbPoolMax: 4 });

  beforeAll(async () => {
    await admin.sql.unsafe(`create database ${dbName}`);
    await runMigrations(conn.sql);
  });
  afterAll(async () => {
    await conn.close().catch(() => {});
    await admin.sql.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin.close();
  });

  const make = async (c: ReturnType<typeof createDb>) => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const metrics = createMetrics();
    registerHealth(app, { db: c.db, jobs: createJobs({ inline: true }), isProd: false, metrics });
    await app.ready();
    return { app, metrics };
  };

  it("ready is 200 with a healthy database", async () => {
    const { app } = await make(conn);
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, checks: { db: true, migrations: true, jobs: true } });
  });

  it("ready returns 503 when db down", async () => {
    const dead = createDb({ databaseUrl: u.toString(), dbPoolMax: 2 });
    const { app } = await make(dead);
    await dead.close();
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(503);
    expect(ready.json().failing).toContain("db");
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
  });

  it("sample job writes rows", async () => {
    const metrics = createMetrics();
    metrics.httpDuration.observe({ route: "/x", method: "GET", status: "200" }, 0.02);
    metrics.otpSent.inc({ outcome: "delivered" }, 3);
    metrics.otpSent.inc({ outcome: "failed" }, 1);
    metrics.pushSent.inc({ provider: "fcm", outcome: "ok" }, 4);
    const job = healthSampleJob({ db: conn.db, metrics });
    await job.handler({}, { attempt: 1 });
    const rows = await conn.sql<{ key: string; value: number }[]>`select key, value from platform.health_samples`;
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(byKey.http_p95_seconds).toBeCloseTo(0.025);
    expect(byKey.otp_delivery_rate).toBeCloseTo(0.75);
    expect(byKey.push_delivery_rate).toBeCloseTo(1);
  });
});
