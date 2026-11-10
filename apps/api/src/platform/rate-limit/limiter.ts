import type { Sql } from "../db.js";
import type { RateRule } from "./limits.js";

export interface HitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface HitManyResult extends HitResult {
  /** Index of the first denying rule, or -1 when all allowed. */
  violated: number;
}

export interface Limiter {
  hit(key: string, rule: RateRule): Promise<HitResult>;
  /** Counts every rule for `key`. Returns the first denying one, else the tightest. */
  hitMany(key: string, rules: readonly RateRule[]): Promise<HitManyResult>;
}

function combine(results: HitResult[]): HitManyResult {
  const violated = results.findIndex((r) => !r.allowed);
  if (violated >= 0) return { ...results[violated]!, violated };
  const tight = results.reduce((a, b) => (b.remaining < a.remaining ? b : a));
  return { ...tight, violated: -1 };
}

export class DbLimiter implements Limiter {
  constructor(private readonly sql: Sql) {}

  async hit(key: string, rule: RateRule): Promise<HitResult> {
    const [r] = await this.run(key, [rule]);
    return r!;
  }

  async hitMany(key: string, rules: readonly RateRule[]): Promise<HitManyResult> {
    if (rules.length === 0) throw new Error("hitMany needs at least one rule");
    return combine(await this.run(key, rules));
  }

  /** One statement for all rules. The window length is part of the stored key, so rules never collide. */
  private async run(key: string, rules: readonly RateRule[]): Promise<HitResult[]> {
    const keys = rules.map((r) => `${key}|${r.windowSeconds}`);
    const windows = rules.map((r) => r.windowSeconds);
    const rows = await this.sql<{ key: string; count: number; retry: number }[]>`
      insert into platform.rate_limits (key, window_start, count)
      select t.k, to_timestamp(floor(extract(epoch from now()) / t.w) * t.w), 1
      from unnest(${keys}::text[], ${windows}::int[]) as t(k, w)
      on conflict (key, window_start) do update set count = rate_limits.count + 1
      returning key, count,
        ceil(extract(epoch from (window_start + (split_part(key, '|', 2)::int * interval '1 second') - now())))::int as retry`;
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return rules.map((rule, i) => {
      const row = byKey.get(keys[i]!)!;
      return {
        allowed: row.count <= rule.limit,
        remaining: Math.max(0, rule.limit - row.count),
        retryAfterSeconds: Math.max(1, row.retry),
      };
    });
  }
}

export class MemoryLimiter implements Limiter {
  private readonly counts = new Map<string, { start: number; count: number }>();
  constructor(private readonly now: () => number = Date.now) {}

  async hit(key: string, rule: RateRule): Promise<HitResult> {
    const nowSec = Math.floor(this.now() / 1000);
    const start = Math.floor(nowSec / rule.windowSeconds) * rule.windowSeconds;
    const k = `${key}|${rule.windowSeconds}|${start}`;
    const count = (this.counts.get(k)?.count ?? 0) + 1;
    this.counts.set(k, { start, count });
    for (const [old, v] of this.counts) if (v.start < nowSec - 2 * 86400) this.counts.delete(old);
    return {
      allowed: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      retryAfterSeconds: Math.max(1, start + rule.windowSeconds - nowSec),
    };
  }

  async hitMany(key: string, rules: readonly RateRule[]): Promise<HitManyResult> {
    if (rules.length === 0) throw new Error("hitMany needs at least one rule");
    const results: HitResult[] = [];
    for (const r of rules) results.push(await this.hit(key, r));
    return combine(results);
  }
}

/** Deletes windows older than 2 days. Called from the `platform.outbox.cleanup` job (T-PLAT-09). */
export async function cleanupRateLimits(sql: Sql): Promise<number> {
  const rows = await sql`delete from platform.rate_limits where window_start < now() - interval '2 days' returning 1`;
  return rows.length;
}
