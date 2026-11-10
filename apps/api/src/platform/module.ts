import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Db } from "./db.js";
import type { EventBus } from "./events/bus.js";
import type { Flags } from "./flags/flags.js";
import type { Jobs } from "./jobs/jobs.js";
import type { Ports } from "./ports/index.js";
import type { Limiter } from "./rate-limit/limiter.js";
import type { Hub } from "./realtime/hub.js";
import type { ObjectStorage } from "./storage/storage.js";

export type { EventBus, Flags, Hub, Jobs, Limiter, ObjectStorage, Ports };

/**
 * Configuration visible to modules: the parsed `Config` plus the AI client. Modules read only the keys they
 * need and validate them (see `identity` and `ai`), so it stays loosely typed.
 */
export type Config = unknown;

/** Facades of every registered module. Each module augments this interface from its `index.ts`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented by each module
export interface Facades {}

export interface ModuleContext {
  db: Db;
  config: Config;
  logger: FastifyBaseLogger;
  bus: EventBus;
  jobs: Jobs;
  storage: ObjectStorage;
  flags: Flags;
  limiter: Limiter;
  /** WebSocket hub; absent when the app has no database connection (unit tests, OpenAPI build). */
  realtime: Hub | undefined;
  /** SMS, push and payment adapters (fakes unless configured). */
  ports: Ports;
  clock: () => Date;
  facades: Partial<Facades>;
}

export interface ModuleDefinition<F = unknown> {
  name: string;
  /** Names of the modules this one may call through their facades (SRS §3.3). */
  dependsOn: readonly string[];
  /** Registers routes, subscribers and jobs, and returns the facade other modules may use. */
  register(app: FastifyInstance, ctx: ModuleContext): Promise<F> | F;
}
