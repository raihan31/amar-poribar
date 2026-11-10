import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "./db/client.js";
import type { OtpStore } from "./otp.js";

export interface AppDeps {
  db: Db;
  otp: OtpStore;
  /** Undefined when no API key is configured; only the SMS parser runs then. */
  anthropic?: Anthropic;
  aiModel?: string;
  jwtSecret: string;
  isProd: boolean;
  logLevel?: string;
  /** Origins allowed by CORS in production. Development allows any origin. */
  corsOrigins?: string[];
}
