import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { env } from "./env.js";
import { createClaudeClient } from "./modules/ai/index.js";

const app = await buildApp({
  db,
  anthropic: env.anthropicApiKey ? createClaudeClient(env.anthropicApiKey) : undefined,
  aiModel: env.aiModel,
  jwtSecret: env.jwtSecret,
  isProd: env.isProd,
  logLevel: env.logLevel,
  corsOrigins: env.corsOrigins,
  openapiPublic: env.openapiPublic,
  ...(env.metricsToken ? { metricsToken: env.metricsToken } : {}),
});

await app.listen({ port: env.port, host: "0.0.0.0" });
app.log.info(`Amar Poribar API on http://localhost:${env.port}`);
