import Fastify from "fastify";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import type { Db } from "../../platform/db.js";
import { registerErrorHandler } from "../../platform/errors.js";
import { testConfig } from "../../../tests/support/config.js";
import { otpMessage } from "./domain/sms-text.js";
import { devSmsRoutes } from "./http/sms-routes.js";
import { FakeSmsGateway } from "./infra/sms/sms-fake.js";
import { createSmsGateway } from "./infra/sms/sms-factory.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const SECRET = "hook-secret-0123456789";

describe("identity sms", () => {
  it("fake gateway records messages", async () => {
    const sms = new FakeSmsGateway();
    const { providerId } = await sms.send({ to: "+8801712345678", text: otpMessage("123456"), reference: "r1" });
    expect(providerId).toBeTruthy();
    expect(sms.lastTo("01712345678")?.reference).toBe("r1");
    expect(sms.lastCode("+8801712345678")).toBe("123456");
    expect(sms.lastCode("+8801900000000")).toBeUndefined();
    sms.clear();
    expect(sms.lastTo("+8801712345678")).toBeUndefined();
  });

  it("factory refuses fake in production", () => {
    expect(() => createSmsGateway({ isProd: true, smsGateway: "fake" })).toThrow(/SMS_GATEWAY/);
    expect(() => createSmsGateway({ isProd: true, smsGateway: "sslwireless" })).toThrow(/SSLWIRELESS/);
    expect(() => createSmsGateway({ isProd: true, smsGateway: "alphasms" })).toThrow(/ALPHA_SMS_API_KEY/);
    expect(createSmsGateway({ isProd: false, smsGateway: "fake" })).toBeInstanceOf(FakeSmsGateway);
  });

  it("sslwireless adapter maps 401 to sms_failed", async () => {
    server.use(
      http.post("https://smsplus.sslwireless.com/api/v3/send-sms", () =>
        HttpResponse.json({ status: "FAILED", error_message: "Invalid token" }, { status: 401 }),
      ),
    );
    const gw = createSmsGateway({
      isProd: true,
      smsGateway: "sslwireless",
      sslwirelessApiToken: "t",
      sslwirelessSid: "sid",
    });
    await expect(gw.send({ to: "+8801712345678", text: "x", reference: "r" })).rejects.toMatchObject({
      status: 502,
      code: "sms_failed",
    });
  });

  it("sslwireless adapter returns the provider id", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post("https://smsplus.sslwireless.com/api/v3/send-sms", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "SUCCESS", status_code: 200, reference_id: "ref-9" });
      }),
    );
    const gw = createSmsGateway({
      isProd: false,
      smsGateway: "sslwireless",
      sslwirelessApiToken: "t",
      sslwirelessSid: "sid",
    });
    const r = await gw.send({ to: "+8801712345678", text: "hello", reference: "abc" });
    expect(r.providerId).toBe("ref-9");
    expect(body).toMatchObject({ api_token: "t", sid: "sid", msisdn: "8801712345678", sms: "hello", csms_id: "abc" });
  });

  it("alpha adapter maps provider errors and retries a network error once", async () => {
    let calls = 0;
    server.use(
      http.post("https://api.sms.net.bd/sendsms", () => {
        calls += 1;
        if (calls === 1) return HttpResponse.error();
        return HttpResponse.json({ error: 405, msg: "Invalid API key" });
      }),
    );
    const gw = createSmsGateway({ isProd: false, smsGateway: "alphasms", alphaSmsApiKey: "k", smsSenderId: "AP" });
    await expect(gw.send({ to: "+8801712345678", text: "x", reference: "r" })).rejects.toMatchObject({
      code: "sms_failed",
    });
    expect(calls).toBe(2);
  });

  it("receipts parse per provider", () => {
    const fake = new FakeSmsGateway();
    const r = fake.parseDeliveryReceipt({ providerId: "p1", status: "delivered", at: "2026-01-02T03:04:05Z" });
    expect(r).toEqual({ providerId: "p1", status: "delivered", at: new Date("2026-01-02T03:04:05Z") });
    const alpha = createSmsGateway({ isProd: false, smsGateway: "alphasms", alphaSmsApiKey: "k" });
    expect(alpha.parseDeliveryReceipt({ request_id: 7, status: "Failed" }).status).toBe("failed");
    expect(() => fake.parseDeliveryReceipt({})).toThrow();
  });

  it("receipt webhook rejects a bad secret", async () => {
    const app = await buildApp({ config: testConfig({ SMS_WEBHOOK_SECRET: SECRET }), db: {} as Db });
    await app.ready();
    const url = "/v1/webhooks/sms/fake";
    const payload = { providerId: "p1", status: "delivered" };
    const none = await app.inject({ method: "POST", url, payload });
    const bad = await app.inject({ method: "POST", url, payload, headers: { "x-webhook-secret": "nope" } });
    expect(none.statusCode).toBe(401);
    expect(bad.statusCode).toBe(401);
    await app.close();
  });

  it("dev endpoint serves the last fake code and is absent in production", async () => {
    const fake = new FakeSmsGateway();
    const app = Fastify();
    registerErrorHandler(app);
    devSmsRoutes(app, fake);
    await fake.send({ to: "+8801712345678", text: otpMessage("654321"), reference: "r" });
    const ok = await app.inject({ method: "GET", url: "/v1/dev/sms/last?phone=01712345678" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ to: "+8801712345678", code: "654321" });
    const none = await app.inject({ method: "GET", url: "/v1/dev/sms/last?phone=01900000000" });
    expect(none.statusCode).toBe(404);
    await app.close();

    const prod = await buildApp({ config: testConfig({ NODE_ENV: "production" }), db: {} as Db });
    await prod.ready();
    const p = await prod.inject({ method: "GET", url: "/v1/dev/sms/last?phone=01712345678" });
    expect(p.statusCode).toBe(404);
    await prod.close();
  });

  it("OTP text is at most 70 characters", () => {
    const text = otpMessage("123456");
    expect(text).toBe("আমার পরিবার কোড: 123456। কাউকে বলবেন না।");
    expect(text.length).toBeLessThanOrEqual(70);
  });
});
