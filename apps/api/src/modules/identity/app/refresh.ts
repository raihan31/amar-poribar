import { HttpError } from "../../../platform/errors.js";
import { issueTokens, type TokenPair } from "./issue-tokens.js";
import type { TokenService } from "./ports.js";

export function refreshTokens(tokens: TokenService, refreshToken: string): TokenPair {
  let payload;
  try {
    payload = tokens.verify(refreshToken);
  } catch {
    throw new HttpError(401, "unauthorized", "Invalid refresh token");
  }
  if (payload.typ !== "refresh") throw new HttpError(401, "unauthorized", "Invalid refresh token");
  return issueTokens(tokens, payload.sub);
}
