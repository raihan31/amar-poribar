import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AT_COOKIE, RT_COOKIE, clearSession } from "./cookies";

export interface JwtClaims {
  sub?: string;
  exp?: number;
}

/** Decodes (does not verify) a JWT payload. */
export function decodeJwt(token: string | undefined): JwtClaims | null {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as JwtClaims;
  } catch {
    return null;
  }
}

export function expiresInSeconds(token: string | undefined): number {
  const exp = decodeJwt(token)?.exp;
  return exp ? exp - Math.floor(Date.now() / 1000) : -1;
}

export function readSession(req: NextRequest): { at?: string; rt?: string } {
  return { at: req.cookies.get(AT_COOKIE)?.value, rt: req.cookies.get(RT_COOKIE)?.value };
}

export function sessionExpired(req?: NextRequest): NextResponse {
  const res = NextResponse.json(
    { error: { code: "session_expired", message: "Session expired" } },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
  clearSession(res, req?.url);
  return res;
}
