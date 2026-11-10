import { normalizeBdPhone } from "@amar-poribar/shared";
import type { OtpStore } from "./ports.js";

/** Issues a code. Outside production the code is returned for local testing; SMS sending arrives with T-ID-01. */
export async function requestOtp(
  deps: { otp: OtpStore; isProd: boolean },
  phone: string,
): Promise<{ sent: true; devCode?: string }> {
  const code = await deps.otp.issue(normalizeBdPhone(phone));
  return deps.isProd ? { sent: true } : { sent: true, devCode: code };
}
