import PgBoss from "pg-boss";
import type { Sql } from "../db.js";
import { cronMatches } from "./cron.js";
import type { JobDefinition } from "./define.js";

export const JOBS_SCHEMA = "platform_jobs";
export const JOBS_TZ = "Asia/Dhaka";

export interface JobsConfig {
  databaseUrl?: string;
  role?: "api" | "worker" | "all";
  /** Run handlers synchronously on `send`; no database involved (module tests). */
  inline?: boolean;
  /** Injected clock for inline `runDue()`. */
  clock?: () => Date;
  onError?: (err: unknown, job: string) => void;
}

export interface SendOptions {
  startAfter?: number | Date;
  singletonKey?: string;
}

export interface Jobs {
  /** Add a job definition (queue, handler, schedule). Call before `start()`. */
  register(def: JobDefinition): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(name: string, data: unknown, opts?: SendOptions): Promise<string | null>;
  schedule(name: string, cron: string, data?: unknown, opts?: { tz?: string }): Promise<void>;
  work(name: string, handler: (data: unknown) => Promise<void> | void, opts?: { concurrency?: number }): Promise<void>;
  /** Jobs that exhausted their retries. */
  deadLetterCount(): Promise<number>;
  /** True when the queue is usable: always in inline mode, a started and reachable pg-boss otherwise. */
  ping(): Promise<boolean>;
  /** Inline mode only: run schedules whose time has come since the last call. */
  runDue(): Promise<string[]>;
}

export function createJobs(config: JobsConfig, sql?: Sql): Jobs {
  return config.inline ? createInline(config) : createPgBoss(config, sql);
}

const MINUTE = 60_000;

function createInline(config: JobsConfig): Jobs {
  const clock = config.clock ?? (() => new Date());
  const defs = new Map<string, JobDefinition>();
  const extraWorkers = new Map<string, (data: unknown) => Promise<void> | void>();
  const schedules = new Map<string, { cron: string; data: unknown; tz: string }>();
  const floor = (t: number) => t - (t % MINUTE);
  let lastChecked = floor(clock().getTime());

  const run = async (name: string, data: unknown) => {
    const def = defs.get(name);
    if (def) {
      await def.handler(def.schema.parse(data), { attempt: 1 });
      return;
    }
    const w = extraWorkers.get(name);
    if (!w) throw new Error(`no handler registered for job ${name}`);
    await w(data);
  };

  return {
    register(def) {
      defs.set(def.name, def);
      if (def.cron) schedules.set(def.name, { cron: def.cron, data: def.cronData ?? {}, tz: JOBS_TZ });
    },
    async start() {},
    async stop() {},
    async send(name, data) {
      await run(name, data);
      return `inline-${name}`;
    },
    async schedule(name, cron, data = {}, opts = {}) {
      const tz = opts.tz ?? JOBS_TZ;
      cronMatches(cron, new Date(0), tz); // validates the expression and the zone
      schedules.set(name, { cron, data, tz });
    },
    async work(name, handler) {
      extraWorkers.set(name, handler);
    },
    async deadLetterCount() {
      return 0;
    },
    async ping() {
      return true;
    },
    async runDue() {
      const end = floor(clock().getTime());
      const ran: string[] = [];
      for (let t = lastChecked + MINUTE; t <= end; t += MINUTE) {
        for (const [name, s] of schedules) {
          if (cronMatches(s.cron, new Date(t), s.tz)) {
            await run(name, s.data);
            ran.push(name);
          }
        }
      }
      if (end > lastChecked) lastChecked = end;
      return ran;
    },
  };
}

function createPgBoss(config: JobsConfig, sql?: Sql): Jobs {
  if (!config.databaseUrl) throw new Error("createJobs needs databaseUrl unless inline");
  const boss = new PgBoss({ connectionString: config.databaseUrl, schema: JOBS_SCHEMA, max: 4 });
  boss.on("error", (e) => config.onError?.(e, "pg-boss"));
  const defs = new Map<string, JobDefinition>();
  const queues = new Set<string>();
  const canWork = (config.role ?? "all") !== "api";
  let started = false;

  const ensureQueue = async (name: string, def?: JobDefinition) => {
    if (queues.has(name)) return;
    await boss.createQueue(name, {
      name,
      retryLimit: def?.retryLimit ?? 5,
      retryBackoff: def?.retryBackoff ?? true,
      retryDelay: def?.retryDelay ?? 30,
    });
    queues.add(name);
  };

  const jobs: Jobs = {
    register(def) {
      defs.set(def.name, def);
    },
    async start() {
      if (started) return;
      started = true;
      await boss.start();
      for (const def of defs.values()) {
        await ensureQueue(def.name, def);
        if (!canWork) continue;
        await jobs.work(def.name, (data) => def.handler(def.schema.parse(data), { attempt: 1 }));
        if (def.cron) await jobs.schedule(def.name, def.cron, def.cronData ?? {});
      }
    },
    async stop() {
      if (!started) return;
      started = false;
      await boss.stop({ graceful: true, timeout: 10_000 });
    },
    async send(name, data, opts = {}) {
      const def = defs.get(name);
      const payload = def ? def.schema.parse(data) : data;
      await ensureQueue(name, def);
      return boss.send(name, payload as object, opts);
    },
    async schedule(name, cron, data = {}, opts = {}) {
      await ensureQueue(name, defs.get(name));
      await boss.schedule(name, cron, data as object, { tz: opts.tz ?? JOBS_TZ });
    },
    async work(name, handler, opts = {}) {
      await ensureQueue(name, defs.get(name));
      await boss.work(name, { pollingIntervalSeconds: 0.5, batchSize: opts.concurrency ?? 1 }, async (batch) => {
        // A throw marks the job failed so pg-boss applies retry and backoff.
        for (const j of batch) await handler(j.data);
      });
    },
    async deadLetterCount() {
      if (!sql) return 0;
      const rows = await sql.unsafe(
        `select (select count(*) from ${JOBS_SCHEMA}.job where state = 'failed')
              + (select count(*) from ${JOBS_SCHEMA}.archive where state = 'failed') as n`,
      );
      return Number(rows[0]?.n ?? 0);
    },
    async ping() {
      if (!started) return false;
      await boss.getDb().executeSql("select 1", []);
      return true;
    },
    async runDue() {
      throw new Error("runDue is only available in inline mode");
    },
  };
  return jobs;
}
