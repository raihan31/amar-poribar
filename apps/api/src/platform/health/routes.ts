import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiErrorSchema } from "@amar-poribar/shared";
import { route } from "../http/route.js";
import type { Db } from "../db.js";
import type { Jobs } from "../jobs/jobs.js";
import { readiness } from "./health.js";
import type { Metrics } from "./metrics.js";

export interface HealthDeps {
  db: Db;
  jobs: Pick<Jobs, "ping" | "deadLetterCount">;
  isProd: boolean;
  metricsToken?: string | undefined;
  metrics: Metrics;
}

function tokenMatches(header: string | undefined, token: string): boolean {
  const given = Buffer.from(header ?? "");
  const want = Buffer.from(`Bearer ${token}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * `/health` (liveness, no I/O), `/ready` (database, migrations, job queue) and `/metrics`
 * (Prometheus text, bearer token). Call before modules register so the duration hook covers
 * every route.
 */
export function registerHealth(app: FastifyInstance, deps: HealthDeps): void {
  const { metrics } = deps;

  metrics.sources.outboxPending = async () => {
    const rows = await deps.db.execute(sql`select count(*)::int as n from platform.outbox where status = 'pending'`);
    return Number((rows[0] as { n?: number } | undefined)?.n ?? 0);
  };
  metrics.sources.jobsDead = () => deps.jobs.deadLetterCount();

  app.addHook("onResponse", async (req, reply) => {
    metrics.httpDuration.observe(
      { route: req.routeOptions?.url ?? "unmatched", method: req.method, status: String(reply.statusCode) },
      reply.elapsedTime / 1000,
    );
  });

  app.get("/health", async () => ({ ok: true }));

  const checks = z.object({ db: z.boolean(), migrations: z.boolean(), jobs: z.boolean() });
  const readyBody = z.object({ ok: z.boolean(), checks, failing: z.array(z.string()) });
  route(
    app,
    {
      method: "GET",
      url: "/ready",
      schema: { tags: ["platform"], summary: "Readiness probe", response: { 200: readyBody, 503: readyBody } },
    },
    async (_req, reply) => {
      const r = await readiness(deps);
      return reply.code(r.ok ? 200 : 503).send(r);
    },
  );

  route(
    app,
    {
      method: "GET",
      url: "/metrics",
      schema: {
        tags: ["platform"],
        summary: "Prometheus metrics",
        response: { 200: z.string(), 401: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (req, reply) => {
      const token = deps.metricsToken;
      if (!token) {
        if (deps.isProd) return reply.code(404).send({ error: { code: "not_found", message: "Not found" } });
      } else if (!tokenMatches(req.headers.authorization, token)) {
        return reply.code(401).send({ error: { code: "unauthorized", message: "Invalid metrics token" } });
      }
      const body = await metrics.metrics();
      return reply.header("content-type", metrics.contentType).send(body);
    },
  );
}
