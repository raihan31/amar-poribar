import { normalizeBdPhone } from "@amar-poribar/shared";
import type { OtpService } from "./otp-service.js";
import type { UserRepo } from "./ports.js";
import type { SessionService, TokenPair } from "./session-service.js";

export async function verifyOtp(
  deps: { otp: OtpService; users: UserRepo; sessions: SessionService },
  input: { phone: string; code: string; deviceId?: string },
): Promise<TokenPair> {
  const phone = normalizeBdPhone(input.phone);
  await deps.otp.verify(phone, input.code);
  const user = await deps.users.upsertByPhone(phone);
  return deps.sessions.start(user.id, input.deviceId);
}
