import type { preHandlerAsyncHookHandler } from "fastify";
import { FLAG_DEFAULTS, FLAG_NAMES } from "@amar-poribar/shared";
import type { Sql } from "../db.js";
import { notFound } from "../errors.js";

export const FLAG_CACHE_MS = 30_000;

/** Where database overrides come from. Tests may pass a fake. */
export interface FlagStore {
  loadAll(): Promise<Record<string, boolean>>;
}

export class DbFlagStore implements FlagStore {
  constructor(private readonly sql: Sql) {}
  async loadAll(): Promise<Record<string, boolean>> {
    const rows = await this.sql<{ name: string; enabled: boolean }[]>`select name, enabled from platform.feature_flags`;
    return Object.fromEntries(rows.map((r) => [r.name, r.enabled]));
  }
}

export interface FlagsOptions {
  store: FlagStore;
  /** Parsed `FEATURE_FLAGS` env overrides (`config.featureFlags`). */
  env?: Record<string, boolean>;
  now?: () => number;
  cacheMs?: number;
}

/** Precedence: env override, then database row, then `FLAG_DEFAULTS`. Database rows are cached for 30 seconds. */
export class Flags {
  private cache: { at: number; rows: Record<string, boolean> } | undefined;
  private readonly env: Record<string, boolean>;
  private readonly now: () => number;
  private readonly cacheMs: number;
  private readonly store: FlagStore;

  constructor(opts: FlagsOptions) {
    this.store = opts.store;
    this.env = opts.env ?? {};
    this.now = opts.now ?? Date.now;
    this.cacheMs = opts.cacheMs ?? FLAG_CACHE_MS;
  }

  private async rows(): Promise<Record<string, boolean>> {
    const t = this.now();
    if (!this.cache || t - this.cache.at >= this.cacheMs) this.cache = { at: t, rows: await this.store.loadAll() };
    return this.cache.rows;
  }

  /** `ctx` is reserved for per-family targeting; it does not change the result yet. */
  async isOn(name: string, ctx?: { familyId?: string; userId?: string }): Promise<boolean> {
    void ctx;
    if (name in this.env) return this.env[name]!;
    const rows = await this.rows();
    if (name in rows) return rows[name]!;
    return (FLAG_DEFAULTS as Record<string, boolean>)[name] ?? false;
  }

  async all(): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    const names = new Set<string>([...FLAG_NAMES, ...Object.keys(await this.rows()), ...Object.keys(this.env)]);
    for (const n of names) out[n] = await this.isOn(n);
    return out;
  }
}

/** preHandler that answers 404 `not_found` while the flag is off, so dark routes do not exist to clients. */
export function requireFlag(flags: Flags, name: string): preHandlerAsyncHookHandler {
  return async () => {
    if (!(await flags.isOn(name))) throw notFound("Not found");
  };
}
