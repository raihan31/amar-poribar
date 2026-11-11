import { normalizeBdPhone } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import type { SmsGateway } from "../../../platform/ports/sms-gateway.js";
import { RESEND_GAP_SEC } from "../domain/otp.js";
import { otpMessage } from "../domain/sms-text.js";
import type { OtpService } from "./otp-service.js";

export interface RequestOtpResult {
  sent: true;
  resendInSeconds: number;
  devCode?: string;
}

/** Issues a code and sends it by SMS. `exposeDevCode` is true only outside production with the fake gateway. */
export async function requestOtp(
  deps: { otp: OtpService; sms: SmsGateway; exposeDevCode: boolean },
  phone: string,
  ip: string,
): Promise<RequestOtpResult> {
  const to = normalizeBdPhone(phone);
  const { code } = await deps.otp.issue(to, ip);
  const res = await deps.sms.send({ to, text: otpMessage(code), kind: "otp" });
  if (res.status === "failed") throw new HttpError(502, "sms_failed", "Could not send the code");
  return deps.exposeDevCode
    ? { sent: true, resendInSeconds: RESEND_GAP_SEC, devCode: code }
    : { sent: true, resendInSeconds: RESEND_GAP_SEC };
}
