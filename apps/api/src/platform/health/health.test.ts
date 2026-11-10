import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { describe, expect, it } from "vitest";
import type { Db } from "../../db/client.js";
import { createJobs } from "../jobs/jobs.js";
import { registerHealth } from "./routes.js";
import { createMetrics } from "./metrics.js";

const throwingDb = new Proxy(
  {},
  {
    get() {
      throw new Error("db touched");
    },
  },
) as Db;

async function build(opts: { token?: string; isProd?: boolean } = {}) {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  const metrics = createMetrics();
  registerHealth(app, {
    db: throwingDb,
    jobs: createJobs({ inline: true }),
    isProd: opts.isProd ?? false,
    metricsToken: opts.token,
    metrics,
  });
  app.get("/v1/things/:id", async () => ({ ok: true }));
  await app.ready();
  return { app, metrics };
}

describe("health", () => {
  it("health never touches db", async () => {
    const { app } = await build();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("metrics requires token", async () => {
    const { app } = await build({ token: "s3cret" });
    expect((await app.inject({ method: "GET", url: "/metrics" })).statusCode).toBe(401);
    const bad = await app.inject({ method: "GET", url: "/metrics", headers: { authorization: "Bearer nope" } });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({ method: "GET", url: "/metrics", headers: { authorization: "Bearer s3cret" } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toContain("process_cpu_user_seconds_total");
    expect(ok.body).toContain("outbox_pending");
  });

  it("metrics is 404 in production when the token is unset", async () => {
    const { app } = await build({ isProd: true });
    expect((await app.inject({ method: "GET", url: "/metrics" })).statusCode).toBe(404);
  });

  it("request histogram labels use route pattern", async () => {
    const { app, metrics } = await build({ token: "t" });
    await app.inject({ method: "GET", url: "/v1/things/123" });
    await app.inject({ method: "GET", url: "/v1/things/456" });
    const body = (await app.inject({ method: "GET", url: "/metrics", headers: { authorization: "Bearer t" } })).body;
    expect(body).toContain('route="/v1/things/:id"');
    expect(body).not.toContain("/v1/things/123");
    const snap = await metrics.snapshot();
    expect(snap.http_request_duration_seconds?.length).toBeGreaterThan(0);
  });

  it("p95 is computed from histogram buckets", async () => {
    const m = createMetrics();
    for (let i = 0; i < 99; i++) m.httpDuration.observe({ route: "/a", method: "GET", status: "200" }, 0.004);
    m.httpDuration.observe({ route: "/a", method: "GET", status: "200" }, 2);
    expect(await m.httpP95Seconds()).toBe(0.005);
  });
});
