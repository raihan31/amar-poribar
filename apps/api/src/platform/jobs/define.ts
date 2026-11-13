import type { z } from "zod";

export interface JobContext {
  /** 1-based attempt number when known (always 1 in inline mode). */
  attempt: number;
}

export interface JobDefinition<T = unknown> {
  /** `module.verb-noun`, e.g. `budgeting.evaluate-alerts`. */
  name: string;
  schema: z.ZodType<T>;
  /** Must be idempotent: a job can be delivered more than once. */
  handler(data: T, ctx: JobContext): Promise<void> | void;
  retryLimit: number;
  retryBackoff: boolean;
  /** Seconds before the first retry (doubles with backoff). */
  retryDelay: number;
  /** Five-field cron, evaluated in Asia/Dhaka. */
  cron?: string;
  /** Payload sent by the schedule. */
  cronData?: T;
}

export interface DefineJobInput<T> {
  name: string;
  schema: z.ZodType<T>;
  handler: JobDefinition<T>["handler"];
  retryLimit?: number;
  retryBackoff?: boolean;
  retryDelay?: number;
  cron?: string;
  cronData?: T;
}

const NAME_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

export function defineJob<T>(input: DefineJobInput<T>): JobDefinition<T> {
  if (!NAME_RE.test(input.name)) throw new Error(`invalid job name: ${input.name} (use module.verb-noun)`);
  return {
    name: input.name,
    schema: input.schema,
    handler: input.handler,
    retryLimit: input.retryLimit ?? 5,
    retryBackoff: input.retryBackoff ?? true,
    retryDelay: input.retryDelay ?? 30,
    ...(input.cron ? { cron: input.cron } : {}),
    ...(input.cronData !== undefined ? { cronData: input.cronData } : {}),
  };
}

/** Gathers the `jobs` export of every module (`modules/<m>/jobs.ts`) and rejects duplicate names. */
export function collectJobs(sources: readonly { jobs?: readonly JobDefinition<unknown>[] }[]): JobDefinition[] {
  const seen = new Map<string, JobDefinition>();
  for (const s of sources)
    for (const j of s.jobs ?? []) {
      if (seen.has(j.name)) throw new Error(`duplicate job name: ${j.name}`);
      seen.set(j.name, j);
    }
  return [...seen.values()];
}
