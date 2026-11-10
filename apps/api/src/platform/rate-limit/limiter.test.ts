import Fastify, { type FastifyRequest } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../db.js";
import { registerErrorHandler } from "../errors.js";
import { runMigrations } from "../migrate.js";
import { DbLimiter, MemoryLimiter, cleanupRateLimits, type Limiter } from "./limiter.js";
import { rateLimitPlugin } from "./plugin.js";

const url = process.env.TEST_DATABASE_URL;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function contract(
  name: string,
  make: () => Limiter | Promise<Limiter>,
  windowsResetWait: (ms: number) => Promise<void>,
) {
  describe(name, () => {
    it("allows up to the limit then denies with retryAfter", async () => {
      const l = await make();
      const rule = { limit: 3, windowSeconds: 3600 };
      const k = `k-${Math.random()}`;
      for (let i = 0; i < 3; i++) {
        const r = await l.hit(k, rule);
        expect(r.allowed).toBe(true);
        expect(r.remaining).toBe(2 - i);
      }
      const denied = await l.hit(k, rule);
      expect(denied.allowed).toBe(false);
      expect(denied.remaining).toBe(0);
      expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(denied.retryAfterSeconds).toBeLessThanOrEqual(3600);
    });

    it("windows reset", async () => {
      const l = await make();
      const rule = { limit: 1, windowSeconds: 1 };
      const k = `k-${Math.random()}`;
      expect((await l.hit(k, rule)).allowed).toBe(true);
      expect((await l.hit(k, rule)).allowed).toBe(false);
      await windowsResetWait(1100);
      expect((await l.hit(k, rule)).allowed).toBe(true);
    });

    it("hitMany reports the first violated limit", async () => {
      const l = await make();
      const rules = [
        { limit: 3, windowSeconds: 60 },
        { limit: 20, windowSeconds: 3600 },
      ];
      const k = `k-${Math.random()}`;
      for (let i = 0; i < 3; i++) expect((await l.hitMany(k, rules)).allowed).toBe(true);
      const r = await l.hitMany(k, rules);
      expect(r.allowed).toBe(false);
      expect(r.violated).toBe(0);
      expect(r.retryAfterSeconds).toBeLessThanOrEqual(60);
    });
  });
}

let fakeNow = 1_700_000_000_000;
contract(
  "MemoryLimiter",
  () => new MemoryLimiter(() => fakeNow),
  async (ms) => {
    fakeNow += ms;
  },
);

describe.skipIf(!url)("DbLimiter", () => {
  const { sql, close } = createDb({ databaseUrl: url ?? "", dbPoolMax: 6 });
  beforeAll(async () => {
    await runMigrations(sql);
  });
  afterAll(() => close());

  contract("DbLimiter contract", () => new DbLimiter(sql), sleep);

  it("cleanup deletes windows older than 2 days", async () => {
    await sql`insert into platform.rate_limits (key, window_start, count) values ('old|60', now() - interval '3 days', 1), ('new|60', now(), 1)`;
    expect(await cleanupRateLimits(sql)).toBeGreaterThanOrEqual(1);
    const rows = await sql`select key from platform.rate_limits where key in ('old|60', 'new|60')`;
    expect(rows.map((r) => r.key as string)).toEqual(["new|60"]);
  });
});

describe("rate limit plugin", () => {
  async function build() {
    const app = Fastify();
    registerErrorHandler(app);
    // Minimal stand-in for @fastify/jwt: the bearer token is the user id.
    const jwtVerify = async function (this: FastifyRequest) {
      const t = this.headers.authorization?.replace("Bearer ", "");
      if (!t) throw new Error("no token");
      return { sub: t, typ: "access" };
    };
    app.decorateRequest("jwtVerify", jwtVerify as never);
    await app.register(rateLimitPlugin, { limiter: new MemoryLimiter() });
    for (const p of ["/health", "/ready", "/metrics", "/v1/openapi.json", "/v1/thing"])
      app.get(p, async () => ({ ok: true }));
    app.get(
      "/v1/custom",
      { config: { rateLimit: { key: () => "custom", limit: 2, windowSeconds: 60 } } },
      async () => ({ ok: true }),
    );
    return app;
  }

  it("plugin exempts health routes", async () => {
    const app = await build();
    for (let i = 0; i < 100; i++) {
      for (const p of ["/health", "/ready", "/metrics", "/v1/openapi.json"]) {
        expect((await app.inject({ method: "GET", url: p })).statusCode).toBe(200);
      }
    }
  });

  it("authenticated and unauthenticated buckets are separate", async () => {
    const app = await build();
    for (let i = 0; i < 60; i++) expect((await app.inject({ url: "/v1/thing" })).statusCode).toBe(200);
    const blocked = await app.inject({ url: "/v1/thing" });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.json().error.code).toBe("rate_limited");
    const authed = await app.inject({ url: "/v1/thing", headers: { authorization: "Bearer u1" } });
    expect(authed.statusCode).toBe(200);
  });

  it("route-level override applies", async () => {
    const app = await build();
    expect((await app.inject({ url: "/v1/custom" })).statusCode).toBe(200);
    expect((await app.inject({ url: "/v1/custom" })).statusCode).toBe(200);
    expect((await app.inject({ url: "/v1/custom" })).statusCode).toBe(429);
  });
});
