import { normalizeBdPhone } from "@amar-poribar/shared";
import { issueTokens, type TokenPair } from "./issue-tokens.js";
import type { OtpService } from "./otp-service.js";
import type { TokenService, UserRepo } from "./ports.js";

export async function verifyOtp(
  deps: { otp: OtpService; users: UserRepo; tokens: TokenService },
  input: { phone: string; code: string },
): Promise<TokenPair> {
  const phone = normalizeBdPhone(input.phone);
  await deps.otp.verify(phone, input.code);
  const user = await deps.users.upsertByPhone(phone);
  return issueTokens(deps.tokens, user.id);
}
