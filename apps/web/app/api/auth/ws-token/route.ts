import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "@/lib/auth/cookies";
import { refreshSession } from "@/lib/auth/refresh";
import { expiresInSeconds, readSession, sessionExpired } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const { at, rt } = readSession(req);
  const headers = { "cache-control": "no-store" };
  if (at && expiresInSeconds(at) > 60) return NextResponse.json({ token: at }, { headers });
  if (!rt) return sessionExpired(req);
  try {
    const tokens = await refreshSession(rt);
    const res = NextResponse.json({ token: tokens.accessToken }, { headers });
    setSession(res, tokens, req.url);
    return res;
  } catch {
    return sessionExpired(req);
  }
}
