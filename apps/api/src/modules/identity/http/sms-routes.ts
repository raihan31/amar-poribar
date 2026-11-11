import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { normalizeBdPhone } from "@amar-poribar/shared";
import { HttpError, notFound, parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import type { SmsDeliveryRepo } from "../infra/sms-delivery-repo.js";
import type { SmsGateway } from "../infra/sms/sms-gateway.js";
import type { FakeSmsGateway } from "../infra/sms/sms-fake.js";

/** Test support: the last fake SMS to a phone. Callers register it only outside production. */
export function devSmsRoutes(app: FastifyInstance, fake: FakeSmsGateway): void {
  app.get("/v1/dev/sms/last", { schema: { hide: true } }, async (req) => {
    const { phone } = parseOr400(z.object({ phone: z.string().min(1) }), req.query);
    const msg = fake.lastTo(normalizeBdPhone(phone));
    if (!msg) throw notFound("No SMS for that phone");
    return { to: msg.to, text: msg.text, code: fake.lastCode(msg.to) ?? null, providerId: msg.providerId };
  });
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export interface SmsWebhookDeps {
  secret: string | undefined;
  repo: SmsDeliveryRepo;
  /** Parsers by provider name in the URL; only the configured provider and the fake are known. */
  gateways: Record<string, Pick<SmsGateway, "parseDeliveryReceipt" | "provider">>;
}

/** `POST /v1/webhooks/sms/:provider`: no user auth, guarded by the `x-webhook-secret` header. */
export function smsWebhookRoutes(app: FastifyInstance, deps: SmsWebhookDeps): void {
  app.post("/v1/webhooks/sms/:provider", { schema: docs.object }, async (req) => {
    const given = req.headers["x-webhook-secret"];
    if (!deps.secret || typeof given !== "string" || !safeEqual(given, deps.secret)) {
      throw new HttpError(401, "unauthorized", "Invalid webhook secret");
    }
    const { provider } = req.params as { provider: string };
    const gateway = deps.gateways[provider];
    if (!gateway) throw notFound("Unknown SMS provider");
    const receipt = gateway.parseDeliveryReceipt(req.body);
    const updated = await deps.repo.applyReceipt({ provider: gateway.provider, ...receipt });
    return { ok: true, updated };
  });
}
