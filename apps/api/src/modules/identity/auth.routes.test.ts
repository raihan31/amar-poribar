import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import type { Db } from "../../platform/db.js";
import { testConfig } from "../../../tests/support/config.js";

const app = await buildApp({ config: testConfig(), db: {} as Db });
beforeAll(() => app.ready());
afterAll(() => app.close());

describe("identity auth routes", () => {
  it("rejects non-Bangladeshi phone numbers", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: "12345" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("invalid_request");
  });

  it("rejects a malformed code", async () => {
    const malformed = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/verify",
      payload: { phone: "01812345678", code: "abcdef" },
    });
    expect(malformed.statusCode).toBe(400);
  });

  it("refresh rejects access token", async () => {
    const access = app.jwt.sign({ sub: "u1", typ: "access" }, { expiresIn: "15m" });
    const res = await app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: access } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("unauthorized");
  });

  it("refresh issues a new pair for a refresh token", async () => {
    const refresh = app.jwt.sign({ sub: "u1", typ: "refresh" }, { expiresIn: "30d" });
    const res = await app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: refresh } });
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual(["accessToken", "refreshToken"]);
  });

  it("authenticate rejects refresh tokens and missing tokens", async () => {
    const refresh = app.jwt.sign({ sub: "u1", typ: "refresh" }, { expiresIn: "30d" });
    const a = await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${refresh}` } });
    const b = await app.inject({ method: "GET", url: "/v1/me" });
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
  });
});
