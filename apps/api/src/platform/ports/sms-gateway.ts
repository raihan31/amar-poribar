export type SmsKind = "otp" | "invite";

export interface SmsMessage {
  to: string;
  text: string;
  kind: SmsKind;
}

export interface SmsResult {
  providerId: string;
  status: "queued" | "sent" | "failed";
}

/** Port implemented by identity/infra (real gateway) and the fakes. */
export interface SmsGateway {
  send(msg: SmsMessage): Promise<SmsResult>;
}
