import type { SmsGateway, SmsMessage, SmsResult } from "../sms-gateway.js";

export class MemorySms implements SmsGateway {
  readonly sent: SmsMessage[] = [];
  private failures: SmsResult["status"][] = [];
  private seq = 0;

  async send(msg: SmsMessage): Promise<SmsResult> {
    const providerId = `mem-sms-${++this.seq}`;
    const status = this.failures.shift() ?? "sent";
    if (status !== "failed") this.sent.push(msg);
    return { providerId, status };
  }

  last(): SmsMessage | undefined {
    return this.sent[this.sent.length - 1];
  }

  clear(): void {
    this.sent.length = 0;
    this.failures = [];
  }

  /** Make the next send return `status` (default "failed"); failed sends are not stored. */
  failNext(status: SmsResult["status"] = "failed"): void {
    this.failures.push(status);
  }
}
