import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "@/lib/auth/cookies";
import { checkCsrf } from "@/lib/auth/csrf";
import { refreshSession } from "@/lib/auth/refresh";
import { readSession, sessionExpired } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const blocked = checkCsrf(req);
  if (blocked) return blocked;
  const { rt } = readSession(req);
  if (!rt) return sessionExpired(req);
  try {
    const tokens = await refreshSession(rt);
    const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
    setSession(res, tokens, req.url);
    return res;
  } catch {
    return sessionExpired(req);
  }
}
