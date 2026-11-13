export interface SmsRequest {
  /** E.164, e.g. `+8801712345678`. */
  to: string;
  text: string;
  /** Our own id, echoed to the provider for support lookups. */
  reference: string;
}

export interface DeliveryReceipt {
  providerId: string;
  status: "delivered" | "failed";
  at: Date;
}

/** Port for OTP delivery through a Bangladeshi SMS gateway (SRS 5.5). */
export interface SmsGateway {
  readonly provider: "fake" | "sslwireless" | "alphasms";
  /** Throws `HttpError(502, "sms_failed")` when the provider refuses or cannot be reached. */
  send(msg: SmsRequest): Promise<{ providerId: string }>;
  /** Throws `HttpError(400, "invalid_request")` when the body is not a receipt of this provider. */
  parseDeliveryReceipt(body: unknown): DeliveryReceipt;
}
