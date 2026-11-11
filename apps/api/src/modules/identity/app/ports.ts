import type { SessionRow } from "../domain/session.js";

export type NewSession = Omit<SessionRow, "rotatedAt" | "revokedAt">;

/** Persistence of refresh-token sessions (T-ID-05). */
export interface SessionRepo {
  insert(s: NewSession & { now: Date }): Promise<void>;
  findById(id: string): Promise<SessionRow | null>;
  /** One transaction: marks `oldId` rotated (only if still unrotated and unrevoked) and inserts the child. False when it lost the race. */
  rotate(oldId: string, child: NewSession, now: Date): Promise<boolean>;
  /** Revokes every open session of the chain; returns their ids. */
  revokeChain(chainId: string, reason: string, now: Date): Promise<string[]>;
  /** True for a missing, revoked or expired session. */
  isRevoked(id: string, now: Date): Promise<boolean>;
  purgeExpiredBefore(cutoff: Date): Promise<number>;
}

export interface OtpChallengeRow {
  id: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
}

/** Persistence of sign-in challenges. Works on digests only; the service does the hashing. */
export interface OtpRepo {
  /** In one transaction: marks the phone's open challenges consumed, then inserts the new one. */
  replaceChallenge(c: { phoneHash: string; codeHash: string; ip: string; now: Date; expiresAt: Date }): Promise<void>;
  /** The newest unconsumed challenge for the phone. */
  findActive(phoneHash: string): Promise<OtpChallengeRow | null>;
  /** Atomically adds one try while `attempts < max`; returns the new count, or null when none is left. */
  bumpAttempts(id: string, max: number): Promise<number | null>;
  /** True only for the caller that consumed the row. */
  consume(id: string, now: Date): Promise<boolean>;
  purgeCreatedBefore(cutoff: Date): Promise<number>;
}

export interface TokenService {
  /** Access JWT `{ sub, sid, typ: "access" }`, 15 minutes. */
  sign(userId: string, sessionId: string): string;
  /** Throws when the signature or expiry is invalid. */
  verify(token: string): { sub: string; typ: string; sid?: string };
}

export interface UserBasics {
  id: string;
  name: string | null;
  phone: string;
  locale: string;
  bnDigits: boolean;
  createdAt: Date;
  updatedAt: Date;
  simpleMode: boolean;
  erasedAt: Date | null;
}

export interface ProfilePatch {
  name?: string | null;
  locale?: string;
  bnDigits?: boolean;
  simpleMode?: boolean;
}

export interface UserRepo {
  /** Updates the given profile columns and `updated_at`; null when the user does not exist or is erased. */
  updateProfile(userId: string, patch: ProfilePatch): Promise<UserBasics | null>;
  upsertByPhone(phone: string): Promise<{ id: string }>;
  findByPhone(phone: string): Promise<{ id: string } | null>;
  getBasics(userId: string): Promise<UserBasics | null>;
  getManyBasics(ids: readonly string[]): Promise<UserBasics[]>;
  getManyNames(ids: readonly string[]): Promise<Map<string, { id: string; name: string | null }>>;
}
