import cors from "@fastify/cors";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { registerAuth } from "./auth.js";
import type { AppDeps } from "./deps.js";
import { registerErrorHandler } from "./errors.js";
import { aiRoutes } from "./routes/ai.js";
import { authRoutes } from "./routes/auth.js";
import { budgetRoutes } from "./routes/budgets.js";
import { festivalRoutes } from "./routes/festivals.js";
import { familyRoutes } from "./routes/families.js";
import { inviteRoutes } from "./routes/invites.js";
import { recurringRoutes } from "./routes/recurring.js";
import { reportRoutes } from "./routes/reports.js";
import { syncRoutes } from "./routes/sync.js";
import { transactionRoutes } from "./routes/transactions.js";
import { modules } from "./modules/registry.js";
import { createLogger, installRequestContext, requestOptions } from "./platform/logger.js";
import { createJobs } from "./platform/jobs/jobs.js";
import type { ModuleContext } from "./platform/module.js";
import { registerOpenApi } from "./platform/openapi/plugin.js";
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
  await registerAuth(app, deps.jwtSecret);
  // Swagger must come before any route so its onRoute hook sees them all.
  await registerOpenApi(app, { version: apiVersion(), expose: !deps.isProd || deps.openapiPublic === true });

  // Modules register in dependency order (SRS §3.1). Existing routes below move into modules in T-PLAT-23..30.
  const ctx: ModuleContext = {
    db: deps.db,
    config: undefined,
    logger: app.log,
    bus: undefined,
    jobs: deps.jobs ?? createJobs({ inline: true }),
    storage: undefined,
    flags: undefined,
    clock: () => new Date(),
    facades: {},
  };
  for (const m of modules) (ctx.facades as Record<string, unknown>)[m.name] = await m.register(app, ctx);

  app.get("/health", async () => ({ ok: true }));

  await app.register(async (scope) => authRoutes(scope, deps));
  await app.register(async (scope) => familyRoutes(scope, deps));
  await app.register(async (scope) => inviteRoutes(scope, deps));
  await app.register(async (scope) => syncRoutes(scope, deps));
  await app.register(async (scope) => transactionRoutes(scope, deps));
  await app.register(async (scope) => aiRoutes(scope, deps));
  await app.register(async (scope) => budgetRoutes(scope, deps));
  await app.register(async (scope) => festivalRoutes(scope, deps));
  await app.register(async (scope) => recurringRoutes(scope, deps));
  await app.register(async (scope) => reportRoutes(scope, deps));
  return app;
}
