import { normalizeBdPhone } from "@amar-poribar/shared";
import type { DeliveryReceipt, SmsGateway, SmsRequest } from "./sms-gateway.js";
import { asRecord, invalidReceipt, receiptFrom } from "./sms-http.js";

const sameNumber = (a: string, b: string) => normalizeBdPhone(a) === normalizeBdPhone(b);

/** In-memory gateway for development and tests. Never allowed in production (see the factory). */
export class FakeSmsGateway implements SmsGateway {
  readonly provider = "fake" as const;
  readonly sent: (SmsRequest & { providerId: string })[] = [];
  private seq = 0;

  async send(msg: SmsRequest): Promise<{ providerId: string }> {
    const providerId = `fake-${++this.seq}`;
    this.sent.push({ ...msg, providerId });
    return { providerId };
  }

  parseDeliveryReceipt(body: unknown): DeliveryReceipt {
    const b = asRecord(body);
    if (b.providerId === undefined) throw invalidReceipt();
    return receiptFrom(b.providerId, b.status, b.at, /^delivered$/i);
  }

  /** The newest message sent to the number (any common spelling of it). */
  lastTo(phone: string): (SmsRequest & { providerId: string }) | undefined {
    return [...this.sent].reverse().find((m) => sameNumber(m.to, phone));
  }

  /** The six-digit code in the newest message to the number. */
  lastCode(phone: string): string | undefined {
    return /\b(\d{6})\b/.exec(this.lastTo(phone)?.text ?? "")?.[1];
  }

  clear(): void {
    this.sent.length = 0;
  }
}
