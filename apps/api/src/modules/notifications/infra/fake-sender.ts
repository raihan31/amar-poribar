import type { PushError, PushMessage, PushResult, PushSender } from "./push-sender.js";

export type SentPush = PushMessage & { sentAt: string };

type Waiter = { predicate: (m: SentPush) => boolean; resolve: (m: SentPush) => void; timer: NodeJS.Timeout };

/** In-memory push sink with an inspection API, used when `PUSH_DRIVER=fake` and in tests. */
export class FakePushSender implements PushSender {
  private sent: SentPush[] = [];
  private failing = new Map<string, PushError>();
  private waiters = new Set<Waiter>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    return messages.map((m) => {
      const error = this.failing.get(m.token);
      if (error) return { token: m.token, ok: false, error };
      const rec: SentPush = { ...m, sentAt: this.clock().toISOString() };
      this.sent.push(rec);
      for (const w of [...this.waiters]) {
        if (w.predicate(rec)) {
          clearTimeout(w.timer);
          this.waiters.delete(w);
          w.resolve(rec);
        }
      }
      return { token: m.token, ok: true };
    });
  }

  /** Every message delivered so far, oldest first. */
  messages(): readonly SentPush[] {
    return [...this.sent];
  }

  clear(): void {
    this.sent = [];
    this.failing.clear();
  }

  /** Makes every later send to `token` fail with `error`. */
  failToken(token: string, error: PushError = "UNREGISTERED"): void {
    this.failing.set(token, error);
  }

  /** Resolves with the first message (already sent or arriving later) matching `predicate`; rejects on timeout. */
  waitFor(predicate: (m: SentPush) => boolean, timeoutMs = 2000): Promise<SentPush> {
    const existing = this.sent.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const w: Waiter = {
        predicate,
        resolve,
        timer: setTimeout(() => {
          this.waiters.delete(w);
          reject(new Error(`push sink: no matching message within ${timeoutMs} ms`));
        }, timeoutMs),
      };
      this.waiters.add(w);
    });
  }
}
