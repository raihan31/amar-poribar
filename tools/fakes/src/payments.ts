import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";

export const PROVIDERS = ["bkash", "nagad", "sslcommerz"] as const;
export const SIGNATURE_HEADER = "x-fake-signature";

export interface PaymentOptions {
  /** Defaults to env FAKE_PAYMENT_SECRET. */
  secret?: string;
  /** Where signed webhooks go. Defaults to env PAYMENT_WEBHOOK_URL (read at send time). */
  webhookUrl?: string;
  /** Public base URL of this server. Defaults to env FAKES_URL. */
  baseUrl?: string;
}

interface FakePayment {
  id: string;
  provider: string;
  amountPaisa: number;
  currency: string;
  reference: string;
  returnUrl: string;
  status: "pending" | "paid" | "failed";
  /** The exact body last sent, so replay resends an identical event. */
  lastBody?: string;
}

export function signPayload(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/** Fake bKash, Nagad and SSLCommerz behind one checkout/webhook shape (SRS DEC-09). */
export function paymentRoutes(app: FastifyInstance, opts: PaymentOptions = {}): void {
  const payments = new Map<string, FakePayment>();
  let seq = 0;
  const secret = () => opts.secret ?? process.env.FAKE_PAYMENT_SECRET ?? "fake-payment-secret";
  const base = () => opts.baseUrl ?? process.env.FAKES_URL ?? "http://localhost:4100";

  const known = (p: string) => (PROVIDERS as readonly string[]).includes(p);

  async function deliver(p: FakePayment, body: string): Promise<number> {
    const url = opts.webhookUrl ?? process.env.PAYMENT_WEBHOOK_URL;
    if (!url) throw new Error("PAYMENT_WEBHOOK_URL is not set");
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signPayload(secret(), body) },
      body,
    });
    return res.status;
  }

  app.post("/pay/:provider/checkout", async (req, reply) => {
    const { provider } = req.params as { provider: string };
    if (!known(provider)) return reply.code(404).send({ error: "unknown_provider" });
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (
      !Number.isInteger(b.amountPaisa) ||
      (b.amountPaisa as number) <= 0 ||
      typeof b.reference !== "string" ||
      typeof b.returnUrl !== "string"
    ) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    const id = `${provider}-${++seq}`;
    payments.set(id, {
      id,
      provider,
      amountPaisa: b.amountPaisa as number,
      currency: typeof b.currency === "string" ? b.currency : "BDT",
      reference: b.reference,
      returnUrl: b.returnUrl,
      status: "pending",
    });
    return { url: `${base()}/pay/${provider}/page/${id}`, id };
  });

  app.get("/pay/:provider/page/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = payments.get(id);
    if (!p) return reply.code(404).send({ error: "not_found" });
    return reply
      .type("text/html")
      .send(`<h1>${p.provider} fake checkout</h1><p>${p.reference}: ${p.amountPaisa} paisa (${p.status})</p>`);
  });

  app.post("/pay/:provider/__complete", async (req, reply) => {
    const b = (req.body ?? {}) as { id?: unknown; status?: unknown };
    const p = typeof b.id === "string" ? payments.get(b.id) : undefined;
    if (!p) return reply.code(404).send({ error: "not_found" });
    if (b.status !== "paid" && b.status !== "failed") return reply.code(400).send({ error: "invalid_request" });
    p.status = b.status;
    p.lastBody = JSON.stringify({
      eventId: `evt-${p.id}-${p.status}`,
      providerPaymentId: p.id,
      status: p.status,
    });
    return { delivered: true, webhookStatus: await deliver(p, p.lastBody), eventId: JSON.parse(p.lastBody).eventId };
  });

  app.post("/pay/:provider/__replay", async (req, reply) => {
    const b = (req.body ?? {}) as { id?: unknown };
    const p = typeof b.id === "string" ? payments.get(b.id) : undefined;
    if (!p?.lastBody) return reply.code(404).send({ error: "not_found" });
    return { delivered: true, webhookStatus: await deliver(p, p.lastBody), eventId: JSON.parse(p.lastBody).eventId };
  });

  app.post("/pay/__reset", async () => {
    payments.clear();
    seq = 0;
    return { ok: true };
  });
}
