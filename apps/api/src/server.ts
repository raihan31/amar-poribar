import Anthropic from "@anthropic-ai/sdk";
import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { env } from "./env.js";
import { OtpStore } from "./otp.js";

const app = await buildApp({
  db,
  otp: new OtpStore(),
  anthropic: env.anthropicApiKey ? new Anthropic({ apiKey: env.anthropicApiKey }) : undefined,
  aiModel: env.aiModel,
  jwtSecret: env.jwtSecret,
  isProd: env.isProd,
  corsOrigins: env.corsOrigins,
});

await app.listen({ port: env.port, host: "0.0.0.0" });
console.log(`Amar Poribar API on http://localhost:${env.port}`);
