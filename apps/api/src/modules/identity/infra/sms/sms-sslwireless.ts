import type { DeliveryReceipt, SmsGateway, SmsRequest } from "./sms-gateway.js";
import { asRecord, invalidReceipt, msisdn, postWithRetry, receiptFrom, smsFailed, type FetchFn } from "./sms-http.js";

const URL = "https://smsplus.sslwireless.com/api/v3/send-sms";

export interface SslWirelessOptions {
  apiToken: string;
  sid: string;
  fetch?: FetchFn;
}

/** SSL Wireless SMS Plus v3. Thin: one request, provider errors become `sms_failed`. */
export class SslWirelessGateway implements SmsGateway {
  readonly provider = "sslwireless" as const;
  private readonly fetchFn: FetchFn;

  constructor(private readonly opts: SslWirelessOptions) {
    this.fetchFn = opts.fetch ?? fetch;
  }

  async send(msg: SmsRequest): Promise<{ providerId: string }> {
    const res = await postWithRetry(this.fetchFn, URL, {
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        api_token: this.opts.apiToken,
        sid: this.opts.sid,
        msisdn: msisdn(msg.to),
        sms: msg.text,
        csms_id: msg.reference,
      }),
    });
    const body = asRecord(await res.json().catch(() => null));
    const ok = res.ok && String(body.status).toUpperCase() === "SUCCESS";
    if (!ok) throw smsFailed();
    const ref = body.reference_id;
    return { providerId: typeof ref === "string" || typeof ref === "number" ? String(ref) : msg.reference };
  }

  /** Delivery report: `{ csms_id | reference_id, status: "Delivered" | ..., delivered_at? }`. */
  parseDeliveryReceipt(body: unknown): DeliveryReceipt {
    const b = asRecord(body);
    const id = b.reference_id ?? b.csms_id;
    if (id === undefined) throw invalidReceipt();
    return receiptFrom(id, b.status, b.delivered_at, /^delivered$/i);
  }
}
