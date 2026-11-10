import type { FastifyInstance, FastifyRequest } from "fastify";
import { tooManyRequests } from "../errors.js";
import type { Limiter } from "./limiter.js";
import { LIMITS } from "./limits.js";

export interface RouteRateLimit {
  key: (req: FastifyRequest) => string;
  limit: number;
  windowSeconds: number;
}

declare module "fastify" {
  interface FastifyContextConfig {
    rateLimit?: RouteRateLimit;
  }
}

export const EXEMPT_PATHS: readonly string[] = ["/health", "/ready", "/metrics", "/v1/openapi.json"];

async function userIdOf(req: FastifyRequest): Promise<string | undefined> {
  if (!req.headers.authorization || typeof req.jwtVerify !== "function") return undefined;
  try {
    const p = await req.jwtVerify<{ sub?: string; typ?: string }>();
    return p.typ === "access" ? p.sub : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Global `onRequest` limit: `u:<userId>` 300/min when authenticated, `ip:<ip>` 60/min otherwise.
 * A route may override with `config: { rateLimit: { key, limit, windowSeconds } }`.
 * Registered without encapsulation so the hook covers every route.
 */
export async function rateLimitPlugin(app: FastifyInstance, opts: { limiter: Limiter }): Promise<void> {
  const { limiter } = opts;
  app.addHook("onRequest", async (req, reply) => {
    const path = req.url.split("?")[0]!;
    if (EXEMPT_PATHS.includes(path)) return;

    const override = req.routeOptions?.config?.rateLimit;
    let key: string;
    let rule: { limit: number; windowSeconds: number };
    if (override) {
      key = override.key(req);
      rule = override;
    } else {
      const userId = await userIdOf(req);
      key = userId ? `u:${userId}` : `ip:${req.ip}`;
      rule = userId ? LIMITS.apiPerUserPerMinute : LIMITS.apiPerIpPerMinute;
    }
    const res = await limiter.hit(key, rule);
    reply.header("X-RateLimit-Limit", String(rule.limit));
    reply.header("X-RateLimit-Remaining", String(res.remaining));
    if (!res.allowed) throw tooManyRequests("rate_limited", res.retryAfterSeconds);
  });
}

(rateLimitPlugin as unknown as Record<symbol, boolean>)[Symbol.for("skip-override")] = true;
