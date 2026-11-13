import { z } from "zod";
import { MODULE_SCHEMA_NAMES } from "../schema-names.js";
import type { Db, Sql } from "../db.js";
import type { EventBus } from "../events/bus.js";
import { drainOnce } from "../events/drain.js";
import { defineJob, type JobDefinition } from "./define.js";
import type { Jobs } from "./jobs.js";

export interface PlatformJobDeps {
  db: Db;
  sql: Sql;
  bus: EventBus;
  jobs: Pick<Jobs, "deadLetterCount">;
  logger?: { info(o: object, m?: string): void; error(o: object, m?: string): void };
  /** Receives gauge values such as `jobs_dead_letters` (wired to /metrics by T-PLAT-15). */
  onMetric?: (name: string, value: number) => void;
}

const empty = z.object({}).passthrough();

/** Counts child rows whose single-column foreign key points at no parent, per schema. */
export async function findOrphans(sql: Sql): Promise<Record<string, number>> {
  const fks = await sql<{ child: string; col: string; parent: string; pcol: string; schema: string }[]>`
    select format('%I.%I', cn.nspname, cc.relname) as child, ca.attname as col,
           format('%I.%I', pn.nspname, pc.relname) as parent, pa.attname as pcol, cn.nspname as schema
    from pg_constraint c
    join pg_class cc on cc.oid = c.conrelid join pg_namespace cn on cn.oid = cc.relnamespace
    join pg_class pc on pc.oid = c.confrelid join pg_namespace pn on pn.oid = pc.relnamespace
    join pg_attribute ca on ca.attrelid = c.conrelid and ca.attnum = c.conkey[1]
    join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
    where c.contype = 'f' and array_length(c.conkey, 1) = 1 and cn.nspname = any(${[...MODULE_SCHEMA_NAMES]})`;
  const out: Record<string, number> = Object.fromEntries(MODULE_SCHEMA_NAMES.map((s) => [s, 0]));
  for (const fk of fks) {
    const [r] = await sql.unsafe(
      `select count(*)::int as n from ${fk.child} c where c."${fk.col}" is not null
         and not exists (select 1 from ${fk.parent} p where p."${fk.pcol}" = c."${fk.col}")`,
    );
    out[fk.schema] = (out[fk.schema] ?? 0) + Number(r?.n ?? 0);
  }
  return out;
}

export function platformJobs(deps: PlatformJobDeps): JobDefinition[] {
  const { sql, db, bus } = deps;
  return [
    defineJob({
      name: "platform.outbox.drain",
      schema: empty,
      cron: "* * * * *", // safety net; the fast path is startOutboxLoop()
      retryLimit: 0,
      handler: async () => {
        await drainOnce(db, bus);
      },
    }),
    defineJob({
      name: "platform.outbox.cleanup",
      schema: empty,
      cron: "0 3 * * *",
      handler: async () => {
        await sql`delete from platform.outbox where status = 'done' and occurred_at < now() - interval '7 days'`;
        await sql`delete from platform.rate_limits where window_start < now() - interval '2 days'`;
        await sql`delete from platform.health_checks where checked_at < now() - interval '30 days'`;
      },
    }),
    defineJob({
      name: "platform.integrity.check",
      schema: empty,
      cron: "30 3 * * *",
      handler: async () => {
        const orphans = await findOrphans(sql);
        const total = Object.values(orphans).reduce((a, b) => a + b, 0);
        await sql`insert into platform.health_checks (name, status, details)
                  values ('integrity', ${total === 0 ? "ok" : "warn"}, ${JSON.stringify({ orphans })}::jsonb)`;
      },
    }),
    defineJob({
      name: "platform.jobs.deadletter-report",
      schema: empty,
      cron: "0 * * * *",
      handler: async () => {
        const count = await deps.jobs.deadLetterCount();
        deps.onMetric?.("jobs_dead_letters", count);
        deps.logger?.info({ deadLetters: count }, "dead letter report");
        await sql`insert into platform.health_checks (name, status, details)
                  values ('jobs.deadletters', ${count === 0 ? "ok" : "warn"}, ${JSON.stringify({ count })}::jsonb)`;
      },
    }),
  ];
}

/**
 * Fast outbox drain for ROLE=worker|all: a 1-second poll plus an immediate drain when `publish`
 * sends NOTIFY outbox. Returns a stop function.
 */
export async function startOutboxLoop(
  deps: Pick<PlatformJobDeps, "db" | "sql" | "bus" | "logger">,
  pollMs = 1000,
): Promise<() => Promise<void>> {
  let running = false;
  let again = false;
  const tick = async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        await drainOnce(deps.db, deps.bus);
      } while (again);
    } catch (e) {
      deps.logger?.error({ err: String(e) }, "outbox drain failed");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), pollMs);
  const sub = await deps.sql.listen("outbox", () => void tick());
  return async () => {
    clearInterval(timer);
    await sub.unlisten();
  };
}
