import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const REFRESH_TTL_MS = 30 * 24 * 3600_000;
/** A rotated token presented again within this window is a racing retry, not theft. */
export const REUSE_GRACE_MS = 10_000;
export const REVOCATION_CACHE_MS = 30_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface SessionRow {
  id: string;
  userId: string;
  chainId: string;
  deviceId: string | null;
  refreshHash: string;
  parentId: string | null;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function hashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** `base64url(sessionId) + "." + base64url(32 random bytes)`; returns the token and the hash to store. */
export function newRefreshToken(sessionId: string): { token: string; hash: string } {
  const secret = randomBytes(32).toString("base64url");
  return { token: `${Buffer.from(sessionId).toString("base64url")}.${secret}`, hash: hashSecret(secret) };
}

/** Null for anything that is not in the session token format (old stateless JWTs have three parts). */
export function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [id, secret] = parts as [string, string];
  if (!/^[A-Za-z0-9_-]+$/.test(id) || !/^[A-Za-z0-9_-]+$/.test(secret)) return null;
  const sessionId = Buffer.from(id, "base64url").toString("utf8");
  if (!UUID_RE.test(sessionId)) return null;
  return { sessionId, secret };
}
