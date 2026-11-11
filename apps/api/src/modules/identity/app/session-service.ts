import { randomUUID } from "node:crypto";
import { HttpError } from "../../../platform/errors.js";
import {
  hashesEqual,
  hashSecret,
  newRefreshToken,
  parseRefreshToken,
  REFRESH_TTL_MS,
  REUSE_GRACE_MS,
  REVOCATION_CACHE_MS,
} from "../domain/session.js";
import type { SessionRepo, TokenService } from "./ports.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SessionService {
  start(userId: string, deviceId?: string | null): Promise<TokenPair>;
  rotate(refreshToken: string, deviceId?: string | null): Promise<TokenPair>;
  /** Backed by a 30 second in-process cache; revocations made by this process show immediately. */
  isSessionRevoked(sessionId: string): Promise<boolean>;
}

export function createSessionService(deps: {
  repo: SessionRepo;
  tokens: TokenService;
  clock: () => Date;
}): SessionService {
  const { repo, tokens, clock } = deps;
  const cache = new Map<string, { revoked: boolean; until: number }>();

  const invalid = () => new HttpError(401, "refresh_invalid", "Invalid refresh token");

  async function start(userId: string, deviceId?: string | null): Promise<TokenPair> {
    const now = clock();
    const id = randomUUID();
    const { token, hash } = newRefreshToken(id);
    await repo.insert({
      id,
      userId,
      chainId: randomUUID(),
      deviceId: deviceId ?? null,
      refreshHash: hash,
      parentId: null,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      now,
    });
    return { accessToken: tokens.sign(userId, id), refreshToken: token };
  }

  async function rotate(refreshToken: string, deviceId?: string | null): Promise<TokenPair> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) throw invalid();
    const row = await repo.findById(parsed.sessionId);
    if (!row || !hashesEqual(row.refreshHash, hashSecret(parsed.secret))) {
      throw invalid();
    }
    const now = clock();
    if (row.revokedAt || row.expiresAt.getTime() < now.getTime()) throw invalid();
    if (row.rotatedAt) {
      if (now.getTime() - row.rotatedAt.getTime() <= REUSE_GRACE_MS) {
        throw new HttpError(409, "refresh_in_flight", "Refresh already in progress; retry with the new token");
      }
      const ids = await repo.revokeChain(row.chainId, "reuse", now);
      markRevoked(ids, now);
      throw new HttpError(401, "refresh_reused", "Refresh token was reused");
    }
    const id = randomUUID();
    const next = newRefreshToken(id);
    const ok = await repo.rotate(
      row.id,
      {
        id,
        userId: row.userId,
        chainId: row.chainId,
        deviceId: deviceId ?? row.deviceId,
        refreshHash: next.hash,
        parentId: row.id,
        expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      },
      now,
    );
    // Lost a race with a concurrent rotation of the same token: same as the in-flight case.
    if (!ok) throw new HttpError(409, "refresh_in_flight", "Refresh already in progress; retry with the new token");
    return { accessToken: tokens.sign(row.userId, id), refreshToken: next.token };
  }

  function markRevoked(ids: readonly string[], now: Date) {
    for (const id of ids) cache.set(id, { revoked: true, until: now.getTime() + REVOCATION_CACHE_MS });
  }

  async function isSessionRevoked(sessionId: string): Promise<boolean> {
    const now = clock();
    const hit = cache.get(sessionId);
    if (hit && hit.until > now.getTime()) return hit.revoked;
    const revoked = await repo.isRevoked(sessionId, now);
    cache.set(sessionId, { revoked, until: now.getTime() + REVOCATION_CACHE_MS });
    return revoked;
  }

  return { start, rotate, isSessionRevoked };
}
