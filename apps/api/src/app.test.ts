import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { Db } from "./db/client.js";
import { monthRange } from "./month.js";
import { OtpStore } from "./otp.js";

// These tests don't touch the database; DB-backed tests need `pnpm db:up` (TODO).
const app = await buildApp({ db: {} as Db, otp: new OtpStore(), jwtSecret: "test", isProd: false });

beforeAll(() => app.ready());
afterAll(() => app.close());

describe("api", () => {
  it("reports health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json()).toEqual({ ok: true });
  });

  it("rejects non-Bangladeshi phone numbers", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: "12345" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("invalid_request");
  });

  it("issues a dev OTP outside production", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: "01712345678" } });
    expect(res.json().devCode).toMatch(/^\d{6}$/);
  });

  it("requires auth on family routes", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/families/x/transactions" });
    expect(res.statusCode).toBe(401);
  });
});

describe("cors in production", () => {
  it("allows only the configured web origin", async () => {
    const prod = await buildApp({
      db: {} as Db, otp: new OtpStore(), jwtSecret: "test", isProd: true, corsOrigins: ["http://localhost:3000"],
    });
    const allowed = await prod.inject({ method: "GET", url: "/health", headers: { origin: "http://localhost:3000" } });
    const other = await prod.inject({ method: "GET", url: "/health", headers: { origin: "https://evil.example" } });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
    await prod.close();
  });
});

describe("monthRange", () => {
  it("uses Dhaka month boundaries", () => {
    const { start, end } = monthRange("2026-12");
    expect(start.toISOString()).toBe("2026-11-30T18:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T18:00:00.000Z");
  });
});
