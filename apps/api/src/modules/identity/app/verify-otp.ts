import { normalizeBdPhone } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { issueTokens, type TokenPair } from "./issue-tokens.js";
import type { OtpStore, TokenService, UserRepo } from "./ports.js";

export async function verifyOtp(
  deps: { otp: OtpStore; users: UserRepo; tokens: TokenService },
  input: { phone: string; code: string },
): Promise<TokenPair> {
  const phone = normalizeBdPhone(input.phone);
  if (!(await deps.otp.verify(phone, input.code))) throw new HttpError(401, "invalid_otp", "Invalid or expired code");
  const user = await deps.users.upsertByPhone(phone);
  return issueTokens(deps.tokens, user.id);
}
