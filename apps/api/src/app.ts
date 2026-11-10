import cors from "@fastify/cors";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import type { AppDeps } from "./deps.js";
import { registerErrorHandler } from "./errors.js";
import { aiRoutes } from "./routes/ai.js";
import { budgetRoutes } from "./routes/budgets.js";
import { festivalRoutes } from "./routes/festivals.js";
import { registerComposition } from "./composition/index.js";
import { EventBus } from "./platform/events/bus.js";
import { recurringRoutes } from "./routes/recurring.js";
import { reportRoutes } from "./routes/reports.js";
import { syncRoutes } from "./routes/sync.js";
import { modules } from "./modules/registry.js";
import { createLogger, installRequestContext, requestOptions } from "./platform/logger.js";
import { createJobs } from "./platform/jobs/jobs.js";
import type { ModuleContext } from "./platform/module.js";
import { registerOpenApi } from "./platform/openapi/plugin.js";
import { healthSampleJob } from "./platform/health/health.js";
import { createMetrics } from "./platform/health/metrics.js";
import { registerHealth } from "./platform/health/routes.js";
import { apiVersion } from "./platform/openapi/version.js";

export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    loggerInstance: createLogger({ level: deps.logLevel ?? (deps.isProd ? "info" : "warn") }),
    ...requestOptions,
  });
  installRequestContext(app);
  registerErrorHandler(app);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  const allowed = deps.corsOrigins ?? [];
  await app.register(cors, { origin: deps.isProd ? (allowed.length ? allowed : false) : true });
  // Swagger must come before any route so its onRoute hook sees them all.
  await registerOpenApi(app, { version: apiVersion(), expose: !deps.isProd || deps.openapiPublic === true });

  const jobs = deps.jobs ?? createJobs({ inline: true });
  const metrics = createMetrics();
  registerHealth(app, { db: deps.db, jobs, isProd: deps.isProd, metricsToken: deps.metricsToken, metrics });
  jobs.register(healthSampleJob({ db: deps.db, metrics }));

  // Modules register in dependency order (SRS §3.1). Existing routes below move into modules in T-PLAT-26..30.
  const ctx: ModuleContext = {
    db: deps.db,
    config: { jwtSecret: deps.jwtSecret, isProd: deps.isProd },
    logger: app.log,
    bus: new EventBus(),
    jobs,
    storage: undefined,
    flags: undefined,
    clock: () => new Date(),
    facades: {},
  };
  for (const m of modules) (ctx.facades as Record<string, unknown>)[m.name] = await m.register(app, ctx);

  // Composition routes join several module facades (SRS §3.1); they register after every module.
  registerComposition(app, ctx);

  await app.register(async (scope) => syncRoutes(scope, deps, ctx));
  await app.register(async (scope) => aiRoutes(scope, deps, ctx));
  await app.register(async (scope) => budgetRoutes(scope, deps, ctx));
  await app.register(async (scope) => festivalRoutes(scope, deps));
  await app.register(async (scope) => recurringRoutes(scope, deps));
  await app.register(async (scope) => reportRoutes(scope, deps, ctx));
  return app;
}
