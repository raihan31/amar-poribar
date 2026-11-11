import { HttpError } from "../../../../platform/errors.js";
import type { DeliveryReceipt } from "./sms-gateway.js";

export const smsFailed = (message = "SMS could not be sent") => new HttpError(502, "sms_failed", message);

export type FetchFn = typeof fetch;

/** POST with a 5 second timeout and one retry on a network error (never on an HTTP status). */
export async function postWithRetry(fetchFn: FetchFn, url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchFn(url, { ...init, method: "POST", signal: AbortSignal.timeout(5000) });
    } catch {
      if (attempt >= 1) throw smsFailed("SMS gateway unreachable");
    }
  }
}

export const invalidReceipt = () => new HttpError(400, "invalid_request", "Unrecognised delivery receipt");

/** "+8801712345678" -> "8801712345678" (the form both providers expect). */
export const msisdn = (to: string) => to.replace(/\D/g, "");

export function receiptFrom(providerId: unknown, status: unknown, at: unknown, delivered: RegExp): DeliveryReceipt {
  if ((typeof providerId !== "string" && typeof providerId !== "number") || typeof status !== "string") {
    throw invalidReceipt();
  }
  const when = typeof at === "string" || typeof at === "number" ? new Date(at) : new Date();
  return {
    providerId: String(providerId),
    status: delivered.test(status) ? "delivered" : "failed",
    at: Number.isNaN(when.getTime()) ? new Date() : when,
  };
}

export const asRecord = (body: unknown): Record<string, unknown> =>
  body && typeof body === "object" ? (body as Record<string, unknown>) : {};
