import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Db } from "../db/client.js";

// Ports that later platform tasks replace with real interfaces. They are `unknown` until then so
// modules can already declare the context shape they will receive.
export type Config = unknown; // T-PLAT-04
export type EventBus = unknown; // T-PLAT-08
import type { Jobs } from "./jobs/jobs.js";
export type { Jobs };
export type ObjectStorage = unknown; // T-PLAT-12
export type Flags = unknown; // T-PLAT-11

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
