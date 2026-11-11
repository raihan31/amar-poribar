import { NextResponse, type NextRequest } from "next/server";
import { clearSession } from "@/lib/auth/cookies";
import { checkCsrf } from "@/lib/auth/csrf";
import { apiUrl } from "@/lib/auth/refresh";
import { readSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const blocked = checkCsrf(req);
  if (blocked) return blocked;
  const { at } = readSession(req);
  if (at) {
    // Best effort: the API may not revoke sessions yet.
    await fetch(`${apiUrl()}/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${at}`, "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
    }).catch(() => null);
  }
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  clearSession(res, req.url);
  return res;
}
