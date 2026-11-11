import type { DeliveryReceipt, SmsGateway, SmsRequest } from "./sms-gateway.js";
import { asRecord, invalidReceipt, msisdn, postWithRetry, receiptFrom, smsFailed, type FetchFn } from "./sms-http.js";

const URL = "https://api.sms.net.bd/sendsms";

export interface AlphaSmsOptions {
  apiKey: string;
  senderId?: string;
  fetch?: FetchFn;
}

/** Alpha SMS (sms.net.bd). Thin: one request, a non-zero `error` or non-2xx status becomes `sms_failed`. */
export class AlphaSmsGateway implements SmsGateway {
  readonly provider = "alphasms" as const;
  private readonly fetchFn: FetchFn;

  constructor(private readonly opts: AlphaSmsOptions) {
    this.fetchFn = opts.fetch ?? fetch;
  }

  async send(msg: SmsRequest): Promise<{ providerId: string }> {
    const form = new URLSearchParams({ api_key: this.opts.apiKey, msg: msg.text, to: msisdn(msg.to) });
    if (this.opts.senderId) form.set("sender_id", this.opts.senderId);
    const res = await postWithRetry(this.fetchFn, URL, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const body = asRecord(await res.json().catch(() => null));
    if (!res.ok || Number(body.error) !== 0) throw smsFailed();
    const requestId = asRecord(body.data).request_id;
    return {
      providerId: typeof requestId === "string" || typeof requestId === "number" ? String(requestId) : msg.reference,
    };
  }

  /** Delivery report: `{ request_id, status: "Sent" | "Delivered" | "Failed" ... }`. */
  parseDeliveryReceipt(body: unknown): DeliveryReceipt {
    const b = asRecord(body);
    if (b.request_id === undefined) throw invalidReceipt();
    return receiptFrom(b.request_id, b.status, b.delivered_at, /^delivered$/i);
  }
}
