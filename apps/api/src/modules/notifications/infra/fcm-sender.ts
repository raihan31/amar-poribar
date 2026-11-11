import type { PushError, PushMessage, PushResult, PushSender } from "./push-sender.js";

type FcmResponse = { success: boolean; error?: { code?: string; retryAfterSeconds?: number } };
export interface FcmMessaging {
  sendEach(messages: object[]): Promise<{ responses: FcmResponse[] }>;
}

export const FCM_BATCH_SIZE = 500;
/** Three retries after the first attempt. */
const RETRY_DELAYS_MS = [1000, 3000, 9000];

export function mapFcmError(code: string | undefined): PushError {
  switch (code) {
    case "messaging/registration-token-not-registered":
    case "messaging/invalid-registration-token":
      return "UNREGISTERED";
    case "messaging/invalid-argument":
      return "INVALID_ARGUMENT";
    case "messaging/message-rate-exceeded":
      return "QUOTA";
    case "messaging/server-unavailable":
      return "UNAVAILABLE";
    default:
      return "OTHER";
  }
}

/** Data-only message: there is never a `notification` block, so the app controls vibration and UI. */
export function toFcmMessage(m: PushMessage): object {
  return {
    token: m.token,
    data: m.data,
    android: {
      priority: m.priority === "high" ? "HIGH" : "NORMAL",
      ttl: m.ttlSeconds * 1000,
      ...(m.collapseKey ? { collapseKey: m.collapseKey } : {}),
      directBootOk: true,
    },
  };
}

export type FcmSenderOptions = {
  sleep?: (ms: number) => Promise<void>;
  /** Returns a number in [0, 1); used for the +-20% jitter. */
  random?: () => number;
};

export class FcmSender implements PushSender {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(
    private readonly messaging: FcmMessaging,
    opts: FcmSenderOptions = {},
  ) {
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = opts.random ?? Math.random;
  }

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const out: PushResult[] = [];
    for (let i = 0; i < messages.length; i += FCM_BATCH_SIZE) {
      out.push(...(await this.sendBatch(messages.slice(i, i + FCM_BATCH_SIZE))));
    }
    return out;
  }

  private async sendBatch(batch: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = new Array<PushResult>(batch.length);
    let pending = batch.map((_, i) => i);
    for (let attempt = 0; ; attempt++) {
      const retryAfters: number[] = [];
      let responses: FcmResponse[];
      try {
        responses = (await this.messaging.sendEach(pending.map((i) => toFcmMessage(batch[i]!)))).responses;
      } catch {
        responses = pending.map(() => ({ success: false, error: { code: "messaging/server-unavailable" } }));
      }
      const next: number[] = [];
      pending.forEach((idx, k) => {
        const r = responses[k];
        const token = batch[idx]!.token;
        if (r?.success) {
          results[idx] = { token, ok: true };
          return;
        }
        const error = mapFcmError(r?.error?.code);
        results[idx] = { token, ok: false, error };
        if (error === "UNAVAILABLE" || error === "QUOTA") {
          next.push(idx);
          if (r?.error?.retryAfterSeconds) retryAfters.push(r.error.retryAfterSeconds * 1000);
        }
      });
      if (next.length === 0 || attempt >= RETRY_DELAYS_MS.length) break;
      const jittered = RETRY_DELAYS_MS[attempt]! * (0.8 + 0.4 * this.random());
      await this.sleep(Math.max(jittered, ...retryAfters));
      pending = next;
    }
    return results;
  }
}

/** Builds the production adapter from base64 service-account JSON. `firebase-admin` is imported only here. */
export async function createFcmSender(credentialsBase64: string): Promise<FcmSender> {
  const credential = JSON.parse(Buffer.from(credentialsBase64, "base64").toString("utf8")) as Record<string, string>;
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getMessaging } = await import("firebase-admin/messaging");
  const name = "amar-poribar-push";
  const app = getApps().find((a) => a.name === name) ?? initializeApp({ credential: cert(credential) }, name);
  return new FcmSender(getMessaging(app));
}
