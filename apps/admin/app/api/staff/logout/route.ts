import { NextResponse, type NextRequest } from "next/server";
import { clearStaffCookies } from "@/lib/auth/cookies";
import { checkCsrf } from "@/lib/auth/csrf";
import { apiUrl, readToken } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const blocked = checkCsrf(req);
  if (blocked) return blocked;
  const token = readToken(req);
  if (token) {
    await fetch(`${apiUrl()}/admin/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);
  }
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  clearStaffCookies(res, req.url);
  return res;
}
