import { normalizeBdPhone } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { getUser, type UserSummary } from "./get-user.js";
import type { OtpService } from "./otp-service.js";
import type { UserRepo } from "./ports.js";
import type { SessionService, TokenPair } from "./session-service.js";

export type VerifyOtpResult = TokenPair & { user: UserSummary; isNewUser: boolean; erasurePending?: true };

export async function verifyOtp(
  deps: { otp: OtpService; users: UserRepo; sessions: SessionService },
  input: { phone: string; code: string; deviceId?: string | undefined },
): Promise<VerifyOtpResult> {
  const phone = normalizeBdPhone(input.phone);
  await deps.otp.verify(phone, input.code);
  const found = await deps.users.signInByPhone(phone);
  if (found.erasedAt) throw new HttpError(401, "account_erased", "This account was erased");
  const [tokens, user] = await Promise.all([
    deps.sessions.start(found.id, input.deviceId),
    getUser(deps.users, found.id),
  ]);
  return {
    ...tokens,
    user: user!,
    isNewUser: found.isNew,
    ...(found.erasurePending ? { erasurePending: true as const } : {}),
  };
}
