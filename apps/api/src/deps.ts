import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "./db/client.js";
import type { Jobs } from "./platform/jobs/jobs.js";

export interface AppDeps {
  db: Db;
  /** Undefined when no API key is configured; only the SMS parser runs then. */
  anthropic?: Anthropic;
  aiModel?: string;
  jwtSecret: string;
  isProd: boolean;
  logLevel?: string;
  /** Origins allowed by CORS in production. Development allows any origin. */
  corsOrigins?: string[];
  /** Serve `/v1/openapi.json` in production too (OPENAPI_PUBLIC=true). */
  openapiPublic?: boolean;
  /** Bearer token for `/metrics`; unset means closed in production, open elsewhere. */
  metricsToken?: string;
  /** Job queue; defaults to inline mode until the worker is wired. */
  jobs?: Jobs;
}
