import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const prod = { NODE_ENV: "production", JWT_SECRET: "a".repeat(40), SMS_GATEWAY: "sslwireless" };

describe("config", () => {
  it("defaults work in development", () => {
    const c = loadConfig({});
    expect(c.port).toBe(4000);
    expect(c.isProd).toBe(false);
    expect(c.jwtSecret).toBe("dev-secret-change-me");
    expect(c.smsGateway).toBe("fake");
    expect(c.storageEndpoint).toBe("http://localhost:9000");
    expect(c.storageBucket).toBe("amar");
    expect(c.turnTtlSeconds).toBe(3600);
    expect(c.role).toBe("all");
    expect(Object.isFrozen(c)).toBe(true);
  });

  it("production rejects short JWT_SECRET", () => {
    expect(() => loadConfig({ ...prod, JWT_SECRET: "x".repeat(31) })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ ...prod, JWT_SECRET: "change-me" })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ ...prod, JWT_SECRET: "" })).toThrow(/JWT_SECRET/);
    expect(loadConfig(prod).isProd).toBe(true);
  });

  it("production rejects SMS_GATEWAY=fake", () => {
    expect(() => loadConfig({ ...prod, SMS_GATEWAY: "fake" })).toThrow(/SMS_GATEWAY/);
  });

  it("lists every invalid variable in one error", () => {
    let message = "";
    try {
      loadConfig({ NODE_ENV: "production", JWT_SECRET: "short", PORT: "abc", ROLE: "nope" });
    } catch (e) {
      message = (e as Error).message;
    }
    for (const name of ["JWT_SECRET", "SMS_GATEWAY", "PORT", "ROLE"]) expect(message).toContain(name);
  });

  it("payment provider group requires all keys when selected", () => {
    expect(() => loadConfig({ PAYMENT_PROVIDER: "real" })).toThrow(/BKASH_APP_KEY/);
    expect(loadConfig({ PAYMENT_PROVIDER: "fake" }).paymentProvider).toBe("fake");
  });

  it("CORS_ORIGIN parses comma separated list", () => {
    const c = loadConfig({ CORS_ORIGIN: "http://localhost:3000, https://app.example.com," });
    expect(c.corsOrigins).toEqual(["http://localhost:3000", "https://app.example.com"]);
  });
});
