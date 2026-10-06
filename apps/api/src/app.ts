import cors from "@fastify/cors";
import type Anthropic from "@anthropic-ai/sdk";
import Fastify from "fastify";
import { registerAuth } from "./auth.js";
import type { Db } from "./db/client.js";
import { registerErrorHandler } from "./errors.js";
import { OtpStore } from "./otp.js";
import { aiRoutes } from "./routes/ai.js";
import { authRoutes } from "./routes/auth.js";
import { familyRoutes } from "./routes/families.js";
import { reportRoutes } from "./routes/reports.js";
import { transactionRoutes } from "./routes/transactions.js";

export interface AppDeps {
  db: Db;
  otp: OtpStore;
  /** Undefined when no API key is configured; only the SMS parser runs then. */
  anthropic?: Anthropic;
  aiModel?: string;
  jwtSecret: string;
  isProd: boolean;
}

export async function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: { level: deps.isProd ? "info" : "warn" } });
  registerErrorHandler(app);
  await app.register(cors, { origin: deps.isProd ? false : true });
  await registerAuth(app, deps.jwtSecret);

  app.get("/health", async () => ({ ok: true }));

  await app.register(async (scope) => authRoutes(scope, deps));
  await app.register(async (scope) => familyRoutes(scope, deps));
  await app.register(async (scope) => transactionRoutes(scope, deps));
  await app.register(async (scope) => aiRoutes(scope, deps));
  await app.register(async (scope) => reportRoutes(scope, deps));
  return app;
}
