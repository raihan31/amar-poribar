import { AlphaSmsGateway } from "./sms-alpha.js";
import { FakeSmsGateway } from "./sms-fake.js";
import type { SmsGateway } from "./sms-gateway.js";
import type { FetchFn } from "./sms-http.js";
import { SslWirelessGateway } from "./sms-sslwireless.js";

/** The parts of the app configuration the factory reads. */
export interface SmsConfig {
  isProd: boolean;
  smsGateway: "fake" | "sslwireless" | "alphasms";
  smsSenderId?: string | undefined;
  sslwirelessApiToken?: string | undefined;
  sslwirelessSid?: string | undefined;
  alphaSmsApiKey?: string | undefined;
}

/** Picks the adapter named by `SMS_GATEWAY`. Throws at startup in production for the fake or missing credentials. */
export function createSmsGateway(config: SmsConfig, opts: { fetch?: FetchFn } = {}): SmsGateway {
  const f = opts.fetch ? { fetch: opts.fetch } : {};
  switch (config.smsGateway) {
    case "fake":
      if (config.isProd) throw new Error("SMS_GATEWAY must not be fake in production");
      return new FakeSmsGateway();
    case "sslwireless":
      if (config.isProd && (!config.sslwirelessApiToken || !config.sslwirelessSid)) {
        throw new Error("SSLWIRELESS_API_TOKEN and SSLWIRELESS_SID are required when SMS_GATEWAY=sslwireless");
      }
      return new SslWirelessGateway({
        apiToken: config.sslwirelessApiToken ?? "",
        sid: config.sslwirelessSid ?? "",
        ...f,
      });
    case "alphasms":
      if (config.isProd && !config.alphaSmsApiKey) {
        throw new Error("ALPHA_SMS_API_KEY is required when SMS_GATEWAY=alphasms");
      }
      return new AlphaSmsGateway({
        apiKey: config.alphaSmsApiKey ?? "",
        ...(config.smsSenderId ? { senderId: config.smsSenderId } : {}),
        ...f,
      });
  }
}
