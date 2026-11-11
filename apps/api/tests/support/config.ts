import { loadConfig, type Config } from "../../src/platform/config.js";

/** A valid, quiet configuration for tests. `over` replaces environment variables, e.g. `{ NODE_ENV: "production" }`. */
export function testConfig(over: Record<string, string | undefined> = {}): Config {
  const production = over.NODE_ENV === "production";
  return loadConfig({
    NODE_ENV: "test",
    JWT_SECRET: production ? "p".repeat(40) : "test-secret",
    ...(production ? { OTP_PEPPER: "o".repeat(40) } : {}),
    LOG_LEVEL: "silent",
    ...(production ? { SMS_GATEWAY: "alphasms" } : {}),
    ...over,
  });
}
