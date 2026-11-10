import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { ApiErrorSchema } from "@amar-poribar/shared";
import { HttpError, conflict, forbidden, notFound, registerErrorHandler, tooManyRequests } from "./errors.js";

async function makeApp() {
  const app = Fastify({ bodyLimit: 100 });
  registerErrorHandler(app);
  app.get("/details", async () => {
    throw new HttpError(401, "unauthorized", "no", { attemptsLeft: 2 });
  });
  app.get("/three", async () => {
    throw new HttpError(404, "not_found", "gone");
  });
  app.get("/boom", async () => {
    throw new Error("secret internals");
  });
  app.get("/rate", async () => {
    throw tooManyRequests("otp_rate_limited", 42);
  });
  app.post("/body", async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe("errors", () => {
  it("HttpError with details is serialised", async () => {
    const app = await makeApp();
    const res = await app.inject("/details");
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: "unauthorized", message: "no", details: { attemptsLeft: 2 } } });
    expect(ApiErrorSchema.safeParse(res.json()).success).toBe(true);
  });

  it("unknown error becomes 500 without stack", async () => {
    const app = await makeApp();
    const res = await app.inject("/boom");
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error.code).toBe("internal");
    expect(body.error.message).toBe("Something went wrong");
    expect(typeof body.error.details.requestId).toBe("string");
    expect(res.body).not.toContain("secret internals");
    expect(res.body).not.toContain("    at ");
  });

  it("Retry-After header is set by tooManyRequests", async () => {
    const app = await makeApp();
    const res = await app.inject("/rate");
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBe("42");
    expect(res.json().error.details).toEqual({ retryAfterSeconds: 42 });
  });

  it("existing 3-arg HttpError still works", async () => {
    const app = await makeApp();
    const res = await app.inject("/three");
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: "not_found", message: "gone" } });
  });

  it("maps oversize bodies and helpers", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/body",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ a: "x".repeat(500) }),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe("payload_too_large");
    expect(notFound("x").status).toBe(404);
    expect(forbidden("x").code).toBe("forbidden");
    expect(conflict("duplicate", "x").status).toBe(409);
  });
});
