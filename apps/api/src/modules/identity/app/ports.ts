export type TokenType = "access" | "refresh";

/** Stores one-time codes. The DB-backed implementation arrives in T-ID-01. */
export interface OtpStore {
  /** Creates and remembers a six-digit code for `phone`, replacing any earlier one. */
  issue(phone: string): Promise<string>;
  /** True once for the right code; false when wrong, expired or after too many attempts. */
  verify(phone: string, code: string): Promise<boolean>;
}

export interface TokenService {
  sign(userId: string, typ: TokenType): string;
  /** Throws when the signature or expiry is invalid. */
  verify(token: string): { sub: string; typ: string };
}

export interface UserBasics {
  id: string;
  name: string | null;
  phone: string;
  locale: string;
  bnDigits: boolean;
}

export interface UserRepo {
  upsertByPhone(phone: string): Promise<{ id: string }>;
  findByPhone(phone: string): Promise<{ id: string } | null>;
  getBasics(userId: string): Promise<UserBasics | null>;
  getManyNames(ids: readonly string[]): Promise<Map<string, { id: string; name: string | null }>>;
}
