import type { TokenService } from "./ports.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function issueTokens(tokens: TokenService, userId: string): TokenPair {
  return { accessToken: tokens.sign(userId, "access"), refreshToken: tokens.sign(userId, "refresh") };
}
