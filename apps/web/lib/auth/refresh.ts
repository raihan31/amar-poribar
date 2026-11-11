import { createHash } from "node:crypto";
import type { Tokens } from "./cookies";

const inflight = new Map<string, Promise<Tokens>>();
const SETTLE_TTL_MS = 10_000;

export function apiUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export class RefreshError extends Error {}

async function callRefresh(refreshToken: string): Promise<Tokens> {
  const res = await fetch(`${apiUrl()}/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) throw new RefreshError(`refresh failed: ${res.status}`);
  const body = (await res.json()) as Partial<Tokens>;
  if (!body.accessToken || !body.refreshToken) throw new RefreshError("refresh response missing tokens");
  return { accessToken: body.accessToken, refreshToken: body.refreshToken };
}

/** Single-flight per refresh token so parallel callers do not trigger reuse detection. */
export function refreshSession(refreshToken: string): Promise<Tokens> {
  const key = createHash("sha256").update(refreshToken).digest("hex");
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = callRefresh(refreshToken);
  inflight.set(key, p);
  const release = () => {
    setTimeout(() => inflight.delete(key), SETTLE_TTL_MS).unref?.();
  };
  p.then(release, release);
  return p;
}

/** Test helper. */
export function _resetRefreshCache() {
  inflight.clear();
}
