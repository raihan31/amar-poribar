import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { ClaudeFake, NoRecordingError, claudeRoutes, loadRecordings, recordingKey } from "./claude.js";
import { SIGNATURE_HEADER, paymentRoutes, signPayload } from "./payments.js";
import Fastify from "fastify";

const SECRET = "test-secret";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((f) => f()));
});

interface Hook {
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

async function setup() {
  const hooks: Hook[] = [];
  const receiver: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      hooks.push({ headers: req.headers, body });
      res.end("ok");
    });
  });
  await new Promise<void>((r) => receiver.listen(0, "127.0.0.1", r));
  cleanup.push(() => new Promise((r) => receiver.close(r)));
  const url = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/hook`;
  const app = Fastify();
  paymentRoutes(app, { secret: SECRET, webhookUrl: url, baseUrl: "http://fakes.test" });
  cleanup.push(() => app.close());
  return { app, hooks };
}

describe("payment fakes", () => {
  it("payment complete sends signed webhook", async () => {
    const { app, hooks } = await setup();
    const co = (
      await app.inject({
        method: "POST",
        url: "/pay/bkash/checkout",
        payload: { amountPaisa: 9900, currency: "BDT", reference: "inv-1", returnUrl: "app://back" },
      })
    ).json();
    expect(co.url).toBe(`http://fakes.test/pay/bkash/page/${co.id}`);
    await app.inject({ method: "POST", url: "/pay/bkash/__complete", payload: { id: co.id, status: "paid" } });
    expect(hooks).toHaveLength(1);
    const h = hooks[0]!;
    expect(h.headers[SIGNATURE_HEADER]).toBe(signPayload(SECRET, h.body));
    expect(JSON.parse(h.body)).toMatchObject({ providerPaymentId: co.id, status: "paid" });
  });

  it("replay sends identical event id", async () => {
    const { app, hooks } = await setup();
    const co = (
      await app.inject({
        method: "POST",
        url: "/pay/nagad/checkout",
        payload: { amountPaisa: 100, currency: "BDT", reference: "r", returnUrl: "u" },
      })
    ).json();
    await app.inject({ method: "POST", url: "/pay/nagad/__complete", payload: { id: co.id, status: "paid" } });
    await app.inject({ method: "POST", url: "/pay/nagad/__replay", payload: { id: co.id } });
    expect(hooks).toHaveLength(2);
    expect(hooks[1]!.body).toBe(hooks[0]!.body);
    expect(hooks[1]!.headers[SIGNATURE_HEADER]).toBe(hooks[0]!.headers[SIGNATURE_HEADER]);
    expect(JSON.parse(hooks[0]!.body).eventId).toBeTruthy();
  });

  it("rejects unknown providers and bad checkouts", async () => {
    const { app } = await setup();
    expect((await app.inject({ method: "POST", url: "/pay/paypal/checkout", payload: {} })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/pay/bkash/checkout", payload: {} })).statusCode).toBe(400);
  });
});

describe("claude fake", () => {
  it("claude fake returns recording or lists missing key", async () => {
    const fake = new ClaudeFake(loadRecordings());
    const r = fake.find("parse-text", "আজ বাজারে ৮৫০ টাকা দিলাম ক্যাশে");
    expect(JSON.parse(r.text).drafts[0]).toMatchObject({ amountTaka: 850, categoryKey: "bazaar", accountType: "cash" });
    expect(r.stopReason).toBe("end_turn");
    const missing = () => fake.find("parse-text", "no such sentence");
    expect(missing).toThrow(NoRecordingError);
    expect(missing).toThrow(recordingKey("parse-text", "no such sentence"));
  });

  it("serves recordings over HTTP and 404s with the key", async () => {
    const app = Fastify();
    claudeRoutes(app);
    cleanup.push(() => app.close());
    const ok = await app.inject({
      method: "POST",
      url: "/claude/v1/messages",
      headers: { "x-fake-feature": "parse-text" },
      payload: { messages: [{ role: "user", content: "বাজার করলাম" }] },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().stop_reason).toBe("end_turn");
    const miss = await app.inject({
      method: "POST",
      url: "/claude/v1/messages",
      payload: { messages: [{ role: "user", content: "zzz" }] },
    });
    expect(miss.statusCode).toBe(404);
    expect(miss.json().error.key).toBe(recordingKey("default", "zzz"));
  });
});
