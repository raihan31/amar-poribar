import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentGateway,
  RefundRequest,
  RefundResult,
  WebhookEvent,
} from "../payment-gateway.js";

export const SIGNATURE_HEADER = "x-fake-signature";

export function signBody(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export class MemoryPayments implements PaymentGateway {
  readonly checkouts = new Map<string, CheckoutRequest>();
  readonly refunds: RefundRequest[] = [];
  private seq = 0;

  constructor(private readonly secret = "memory-payment-secret") {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const providerPaymentId = `mem-pay-${++this.seq}`;
    this.checkouts.set(providerPaymentId, req);
    return { checkoutUrl: `memory://pay/${providerPaymentId}`, providerPaymentId };
  }

  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookEvent | null {
    const raw = headers[SIGNATURE_HEADER];
    const sig = Array.isArray(raw) ? raw[0] : raw;
    if (!sig) return null;
    const expected = Buffer.from(signBody(this.secret, rawBody));
    const got = Buffer.from(sig);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    try {
      const b = JSON.parse(rawBody) as Partial<WebhookEvent>;
      if (typeof b.eventId !== "string" || typeof b.providerPaymentId !== "string") return null;
      if (b.status !== "paid" && b.status !== "failed") return null;
      return { eventId: b.eventId, providerPaymentId: b.providerPaymentId, status: b.status };
    } catch {
      return null;
    }
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    this.refunds.push(req);
    return { refundId: `mem-refund-${this.refunds.length}`, status: "refunded" };
  }

  /** Build the signed webhook a provider would send once the user finishes paying. */
  complete(providerPaymentId: string, status: "paid" | "failed" = "paid") {
    const rawBody = JSON.stringify({ eventId: `mem-evt-${providerPaymentId}`, providerPaymentId, status });
    return { headers: { [SIGNATURE_HEADER]: signBody(this.secret, rawBody) }, rawBody };
  }
}
