export interface CheckoutRequest {
  amountPaisa: number;
  currency: "BDT";
  /** Our own reference (invoice id); echoed back by the provider. */
  reference: string;
  returnUrl: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  providerPaymentId: string;
}

export interface WebhookEvent {
  /** Unique per provider event; the consumer dedupes on it. */
  eventId: string;
  providerPaymentId: string;
  status: "paid" | "failed";
}

export interface RefundRequest {
  providerPaymentId: string;
  amountPaisa: number;
}

export interface RefundResult {
  refundId: string;
  status: "refunded" | "failed";
}

/** Port implemented by billing/infra (bKash, Nagad, SSLCommerz adapters) and the fakes. */
export interface PaymentGateway {
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Returns null when the signature is invalid or the body is not a payment event. */
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookEvent | null;
  /** Declared for later billing work; not used yet. */
  refund(req: RefundRequest): Promise<RefundResult>;
}
