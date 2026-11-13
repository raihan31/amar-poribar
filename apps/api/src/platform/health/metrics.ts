import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export type MetricsSnapshot = Record<string, { labels: Record<string, string | number>; value: number }[]>;

/** A sample as returned by prom-client; `metricName` is set on histogram series such as `_bucket`. */
interface SeriesValue {
  value: number;
  labels: Record<string, string | number | undefined>;
  metricName?: string;
}

/** Cumulative bucket counts of the request histogram, summed over all label sets. */
export type BucketCounts = Map<number, number>;

/** Upper bound of the bucket holding the `q` quantile (histogram-bucket resolution). */
export function quantileFromBuckets(buckets: BucketCounts, q: number): number | undefined {
  const bounds = [...buckets.keys()].sort((a, b) => a - b);
  const total = buckets.get(Infinity) ?? 0;
  if (total <= 0) return undefined;
  const target = q * total;
  for (const b of bounds) if ((buckets.get(b) ?? 0) >= target) return b === Infinity ? (bounds.at(-2) ?? b) : b;
  return undefined;
}

/**
 * One metrics registry per app instance (tests build many apps). Gauges whose source of truth is
 * elsewhere (`outbox_pending`, `jobs_dead_total`, `ws_connections`) are refreshed through the
 * `sources` callbacks on every scrape or `snapshot()`.
 */
export function createMetrics() {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const sources: {
    outboxPending?: () => Promise<number> | number;
    jobsDead?: () => Promise<number> | number;
    wsConnections?: () => number;
  } = {};

  const httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration by route pattern",
    labelNames: ["route", "method", "status"] as const,
    registers: [registry],
  });
  const wsConnections = new Gauge({
    name: "ws_connections",
    help: "Open WebSocket connections",
    registers: [registry],
    collect() {
      if (sources.wsConnections) this.set(sources.wsConnections());
    },
  });
  const outboxPending = new Gauge({
    name: "outbox_pending",
    help: "Outbox events not yet delivered",
    registers: [registry],
    async collect() {
      // A failing source (database down) must not break the scrape of the other metrics.
      if (sources.outboxPending) this.set(await Promise.resolve(sources.outboxPending()).catch(() => NaN));
    },
  });
  const jobsDead = new Gauge({
    name: "jobs_dead_total",
    help: "Jobs that exhausted their retries",
    registers: [registry],
    async collect() {
      if (sources.jobsDead) this.set(await Promise.resolve(sources.jobsDead()).catch(() => NaN));
    },
  });
  const rateLimited = new Counter({
    name: "rate_limited_total",
    help: "Requests rejected by rate limits",
    registers: [registry],
  });
  const aiRequests = new Counter({
    name: "ai_requests_total",
    help: "AI requests",
    labelNames: ["feature", "outcome"] as const,
    registers: [registry],
  });
  const pushSent = new Counter({
    name: "push_sent_total",
    help: "Push notifications sent",
    labelNames: ["provider", "outcome"] as const,
    registers: [registry],
  });
  const ledgerPurged = new Counter({
    name: "ledger_purged_total",
    help: "Soft-deleted transactions removed by the purge job",
    registers: [registry],
  });
  const otpSent = new Counter({
    name: "otp_sent_total",
    help: "OTP messages sent",
    labelNames: ["outcome"] as const,
    registers: [registry],
  });

  /** Histogram buckets summed over every label set. */
  async function httpBuckets(): Promise<BucketCounts> {
    const out: BucketCounts = new Map();
    const m = (await httpDuration.get()) as unknown as { values: SeriesValue[] };
    for (const v of m.values) {
      if (v.metricName !== "http_request_duration_seconds_bucket") continue;
      const le = v.labels.le === "+Inf" ? Infinity : Number(v.labels.le);
      out.set(le, (out.get(le) ?? 0) + v.value);
    }
    return out;
  }

  /** Sum of a counter's values whose labels match `pick`, and the total. */
  async function counterTotals(c: Counter<string>, pick: (l: Record<string, string | number | undefined>) => boolean) {
    let good = 0;
    let all = 0;
    for (const v of (await c.get()).values as SeriesValue[]) {
      all += v.value;
      if (pick(v.labels)) good += v.value;
    }
    return { good, all };
  }

  return {
    registry,
    httpDuration,
    wsConnections,
    outboxPending,
    jobsDead,
    rateLimited,
    aiRequests,
    pushSent,
    otpSent,
    ledgerPurged,
    sources,
    httpBuckets,
    counterTotals,
    /** p95 request latency in seconds since process start, or undefined with no traffic. */
    async httpP95Seconds() {
      return quantileFromBuckets(await httpBuckets(), 0.95);
    },
    contentType: registry.contentType,
    metrics: () => registry.metrics(),
    /** The same data as JSON, for the admin health module (FR-ADM-10). */
    async snapshot(): Promise<MetricsSnapshot> {
      const out: MetricsSnapshot = {};
      for (const m of await registry.getMetricsAsJSON()) {
        out[m.name] = (m.values as SeriesValue[]).map((v) => ({
          labels: {
            ...(v.labels as Record<string, string | number>),
            ...(v.metricName && v.metricName !== m.name ? { series: v.metricName } : {}),
          },
          value: v.value,
        }));
      }
      return out;
    },
  };
}

export type Metrics = ReturnType<typeof createMetrics>;
