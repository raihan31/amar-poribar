import cors from "@fastify/cors";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { registerComposition } from "./composition/index.js";
import { createClaudeClient, type AiClient } from "./modules/ai/index.js";
import { modules } from "./modules/registry.js";
import type { Config } from "./platform/config.js";
import type { Db, Sql } from "./platform/db.js";
import { registerErrorHandler } from "./platform/errors.js";
import { EventBus } from "./platform/events/bus.js";
import { DbFlagStore, Flags } from "./platform/flags/flags.js";
import { registerFlagRoutes } from "./platform/flags/routes.js";
import { healthSampleJob } from "./platform/health/health.js";
import { createMetrics } from "./platform/health/metrics.js";
import { registerHealth } from "./platform/health/routes.js";
import { createJobs, type Jobs } from "./platform/jobs/jobs.js";
import { platformJobs, startOutboxLoop } from "./platform/jobs/platform-jobs.js";
import { createLogger, installRequestContext, requestOptions } from "./platform/logger.js";
import type { ModuleContext } from "./platform/module.js";
import { registerOpenApi } from "./platform/openapi/plugin.js";
import { apiVersion } from "./platform/openapi/version.js";
import { createPorts, type Ports } from "./platform/ports/index.js";
import { DbLimiter, MemoryLimiter, type Limiter } from "./platform/rate-limit/limiter.js";
import { rateLimitPlugin } from "./platform/rate-limit/plugin.js";
import { PgFanout, type Fanout } from "./platform/realtime/fanout.js";
import { Hub } from "./platform/realtime/hub.js";
import { realtimePlugin } from "./platform/realtime/plugin.js";
import { MemoryObjectStorage } from "./platform/storage/memory.js";
import { S3ObjectStorage } from "./platform/storage/s3.js";
import type { ObjectStorage } from "./platform/storage/storage.js";

/** Everything here is optional: tests inject fakes, and the server relies on the defaults chosen from `config`. */
export interface AppDeps {
  /**
   * The raw connection behind `db`. Enables the PostgreSQL-backed limiter, flags, job queue, fanout and
   * platform jobs; without it (unit tests, OpenAPI build) the in-memory equivalents are used.
   */
  sql?: Sql;
  /** When absent, built from `config.anthropicApiKey`; with no key only the offline SMS parser runs. */
  anthropic?: AiClient;
  jobs?: Jobs;
  storage?: ObjectStorage;
  flags?: Flags;
  limiter?: Limiter;
  fanout?: Fanout;
  ports?: Partial<Ports>;
  clock?: () => Date;
  /** Drain the outbox continuously (ROLE=worker|all in the server). Needs `sql`. */
  outboxLoop?: boolean;
}

export interface BuildAppOptions {
  config: Config;
  db: Db;
  deps?: AppDeps;
}

/** Builds the Fastify app: platform services first, then every module in registry order, then composition routes. */
export async function buildApp({ config, db, deps = {} }: BuildAppOptions) {
  const sql = deps.sql;
  const app = Fastify({ loggerInstance: createLogger({ level: config.logLevel }), ...requestOptions });
  installRequestContext(app);
  registerErrorHandler(app);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Platform services (SRS §3.4).
  const logger = app.log;
  const bus = new EventBus();
  const metrics = createMetrics();
  const jobs =
    deps.jobs ??
    (sql
      ? createJobs(
          {
            databaseUrl: config.databaseUrl,
            role: config.role,
            onError: (err, job) => logger.error({ err: String(err), job }, "job queue error"),
          },
          sql,
        )
      : createJobs({ inline: true }));
  const storage =
    deps.storage ??
    (config.nodeEnv === "test"
      ? new MemoryObjectStorage()
      : new S3ObjectStorage({
          endpoint: config.storageEndpoint,
          bucket: config.storageBucket,
          accessKey: config.storageAccessKey,
          secretKey: config.storageSecretKey,
          region: config.storageRegion,
        }));
  const flags =
    deps.flags ??
    new Flags({
      store: sql ? new DbFlagStore(sql) : { loadAll: async () => ({}) },
      env: config.featureFlags,
    });
  const limiter = deps.limiter ?? (sql ? new DbLimiter(sql) : new MemoryLimiter());
  const ports = createPorts(config, deps.ports);

  const allowed = config.corsOrigins;
  await app.register(cors, { origin: config.isProd ? (allowed.length ? allowed : false) : true });
  // Swagger must come before any route so its onRoute hook sees them all.
  await registerOpenApi(app, { version: apiVersion(), expose: !config.isProd || config.openapiPublic });
  await app.register(rateLimitPlugin, { limiter });

  registerHealth(app, { db, jobs, isProd: config.isProd, metricsToken: config.metricsToken, metrics });
  registerFlagRoutes(app, flags);
  jobs.register(healthSampleJob({ db, metrics }));
  if (sql) {
    for (const def of platformJobs({ db, sql, bus, jobs, logger })) jobs.register(def);
  }

  const ctx: ModuleContext = {
    db,
    config: { ...config, ai: { client: deps.anthropic ?? aiClientFor(config), model: config.aiModel } },
    logger,
    bus,
    jobs,
    storage,
    flags,
    limiter,
    realtime: undefined,
    ports,
    clock: deps.clock ?? (() => new Date()),
    facades: {},
  };

  // WebSocket hub: identity and families are known only after the modules register, so the hub asks lazily.
  const fanout =
    deps.fanout ?? (sql ? new PgFanout(sql, (err) => logger.error({ err: String(err) }, "fanout")) : undefined);
  if (config.role !== "worker" && fanout) {
    const hub = new Hub({
      verifyAccessToken: (token) => {
        const identity = ctx.facades.identity;
        if (!identity) throw new Error("identity module is not registered");
        return identity.verifyAccessToken(token);
      },
      isMember: async (userId, familyId) => (await ctx.facades.families?.isMember(familyId, userId)) ?? false,
      fanout,
      bus,
      onError: (err) => logger.error({ err: String(err) }, "realtime error"),
    });
    await app.register(realtimePlugin, { hub });
    ctx.realtime = hub;
  }

  // Modules register in dependency order (SRS §3.1); the registry is the only list of modules.
  for (const m of modules) (ctx.facades as Record<string, unknown>)[m.name] = await m.register(app, ctx);

  // Composition routes join several module facades (SRS §3.1); they register after every module.
  registerComposition(app, ctx);

  let stopOutbox: (() => Promise<void>) | undefined;
  app.addHook("onReady", async () => {
    await jobs.start();
    if (deps.outboxLoop && sql) stopOutbox = await startOutboxLoop({ db, sql, bus, logger });
  });
  app.addHook("onClose", async () => {
    await stopOutbox?.();
    await jobs.stop();
  });

  return app;
}

function aiClientFor(config: Config): AiClient | undefined {
  return config.anthropicApiKey ? createClaudeClient(config.anthropicApiKey) : undefined;
}
