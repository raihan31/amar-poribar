import { normalizeBdPhone } from "@amar-poribar/shared";
import type { OtpService } from "./otp-service.js";

/** Issues a code. Outside production the code is returned for local testing; SMS sending arrives with T-ID-03/04. */
export async function requestOtp(
  deps: { otp: OtpService; isProd: boolean },
  phone: string,
  ip: string,
): Promise<{ sent: true; devCode?: string }> {
  const { code } = await deps.otp.issue(normalizeBdPhone(phone), ip);
  return deps.isProd ? { sent: true } : { sent: true, devCode: code };
}
