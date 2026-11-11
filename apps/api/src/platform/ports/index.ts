import type { Config } from "../config.js";
import { MemoryPayments } from "./fakes/memory-payments.js";
import { MemoryPush } from "./fakes/memory-push.js";
import { MemorySms } from "./fakes/memory-sms.js";
import type { PaymentGateway } from "./payment-gateway.js";
import type { PushSender } from "./push-sender.js";
import type { SmsGateway } from "./sms-gateway.js";

export interface Ports {
  sms: SmsGateway;
  push: PushSender;
  payments: PaymentGateway;
}

/** A configured provider whose adapter is not part of this build: it fails loudly on use and never pretends to send. */
const unavailablePorts = new WeakSet<object>();

function unavailable<T extends object>(what: string): T {
  const port = new Proxy({} as T, {
    get: () => () => Promise.reject(new Error(`${what} is configured but its adapter is not available`)),
  });
  unavailablePorts.add(port);
  return port;
}

/** True for the placeholder `createPorts` returns when a real provider is configured but has no adapter here. */
export const isUnavailablePort = (port: object): boolean => unavailablePorts.has(port);

/**
 * Production adapters by configuration (`SMS_GATEWAY`, `PUSH_PROVIDER`, `PAYMENT_PROVIDER`); the in-memory
 * fakes otherwise. `overrides` lets tests inject their own instances.
 */
export function createPorts(
  config: Pick<Config, "smsGateway" | "pushProvider" | "paymentProvider">,
  overrides: Partial<Ports> = {},
): Ports {
  return {
    sms: overrides.sms ?? (config.smsGateway === "fake" ? new MemorySms() : unavailable<SmsGateway>("SMS gateway")),
    push: overrides.push ?? (config.pushProvider === "fake" ? new MemoryPush() : unavailable<PushSender>("FCM push")),
    payments:
      overrides.payments ??
      (config.paymentProvider === "fake" ? new MemoryPayments() : unavailable<PaymentGateway>("Payment gateway")),
  };
}
