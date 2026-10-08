import { afterEach, describe, expect, it, vi } from "vitest";

async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  return (await import("./env.js")).env;
}

afterEach(() => vi.unstubAllEnvs());

describe("env", () => {
  it("uses a dev secret outside production, including when Compose passes an empty value", async () => {
    expect((await loadEnv({ NODE_ENV: "development", JWT_SECRET: "" })).jwtSecret).toBe("dev-secret-change-me");
  });

  it("refuses to start in production without a strong secret", async () => {
    await expect(loadEnv({ NODE_ENV: "production", JWT_SECRET: "" })).rejects.toThrow(/JWT_SECRET/);
    await expect(loadEnv({ NODE_ENV: "production", JWT_SECRET: "change-me" })).rejects.toThrow(/JWT_SECRET/);
    await expect(loadEnv({ NODE_ENV: "production", JWT_SECRET: "x".repeat(31) })).rejects.toThrow(/JWT_SECRET/);
    expect((await loadEnv({ NODE_ENV: "production", JWT_SECRET: "a".repeat(40) })).jwtSecret).toBe("a".repeat(40));
  });

  it("parses CORS origins", async () => {
    const env = await loadEnv({ NODE_ENV: "development", CORS_ORIGIN: "http://localhost:3000, https://app.example.com" });
    expect(env.corsOrigins).toEqual(["http://localhost:3000", "https://app.example.com"]);
  });
});
