import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db.js";
import { defineJob } from "../jobs/define.js";
import type { Jobs } from "../jobs/jobs.js";
import { quantileFromBuckets, type BucketCounts, type Metrics } from "./metrics.js";
import { healthSamples } from "./schema.js";

export const CHECK_TIMEOUT_MS = 2000;
export const SAMPLE_RETENTION_DAYS = 14;

export type CheckName = "db" | "migrations" | "jobs";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

async function passes(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await withTimeout(fn(), CHECK_TIMEOUT_MS);
  } catch {
    return false;
  }
}

/** Readiness: database answers, migrations were applied, job queue is connected. */
export async function readiness(deps: { db: Db; jobs: Pick<Jobs, "ping"> }) {
  const [db, migrations, jobs] = await Promise.all([
    passes(async () => {
      await deps.db.execute(sql`select 1`);
      return true;
    }),
    passes(async () => {
      const rows = await deps.db.execute(sql`select 1 from platform.schema_migrations limit 1`);
      return rows.length > 0;
    }),
    passes(() => deps.jobs.ping()),
  ]);
  const checks: Record<CheckName, boolean> = { db, migrations, jobs };
  const failing = (Object.keys(checks) as CheckName[]).filter((k) => !checks[k]);
  return { ok: failing.length === 0, checks, failing };
}

const empty = z.object({}).passthrough();

const delta = (now: BucketCounts, before: BucketCounts): BucketCounts =>
  new Map([...now].map(([le, v]) => [le, v - (before.get(le) ?? 0)]));

/**
 * `platform.health.sample` (every minute): p95 latency, OTP delivery rate and push delivery rate
 * over the period since the previous sample. A metric with no activity writes no row.
 */
export function healthSampleJob(deps: { db: Db; metrics: Metrics; now?: () => Date }) {
  const { db, metrics } = deps;
  let prevBuckets: BucketCounts = new Map();
  let prevOtp = { good: 0, all: 0 };
  let prevPush = { good: 0, all: 0 };

  return defineJob({
    name: "platform.health.sample",
    schema: empty,
    cron: "* * * * *",
    retryLimit: 0,
    handler: async () => {
      const at = deps.now?.() ?? new Date();
      const rows: { at: Date; key: string; value: number }[] = [];

      const buckets = await metrics.httpBuckets();
      const p95 = quantileFromBuckets(delta(buckets, prevBuckets), 0.95);
      prevBuckets = buckets;
      if (p95 !== undefined) rows.push({ at, key: "http_p95_seconds", value: p95 });

      const otp = await metrics.counterTotals(metrics.otpSent, (l) => l.outcome !== "failed");
      if (otp.all - prevOtp.all > 0)
        rows.push({ at, key: "otp_delivery_rate", value: (otp.good - prevOtp.good) / (otp.all - prevOtp.all) });
      prevOtp = otp;

      const push = await metrics.counterTotals(metrics.pushSent, (l) => l.outcome === "ok");
      if (push.all - prevPush.all > 0)
        rows.push({ at, key: "push_delivery_rate", value: (push.good - prevPush.good) / (push.all - prevPush.all) });
      prevPush = push;

      if (rows.length > 0) await db.insert(healthSamples).values(rows).onConflictDoNothing();
      await db.execute(
        sql`delete from platform.health_samples where at < ${at.toISOString()}::timestamptz - make_interval(days => ${SAMPLE_RETENTION_DAYS})`,
      );
    },
  });
}
