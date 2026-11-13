import { NextResponse, type NextRequest } from "next/server";
import { STAFF_MAX_AGE, setStaffCookies } from "@/lib/auth/cookies";
import { apiUrl, readToken, sessionExpired, upstreamDown } from "@/lib/auth/session";

const NO_STORE = { "cache-control": "no-store" };

/** Also serves as the "Stay signed in" ping: a successful call re-issues the sliding cookies. */
export async function GET(req: NextRequest) {
  const token = readToken(req);
  if (!token) return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  const upstream = await fetch(`${apiUrl()}/admin/v1/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!upstream) return upstreamDown();
  if (upstream.status === 401) return sessionExpired(req);
  if (!upstream.ok) return NextResponse.json({ authenticated: false }, { status: upstream.status, headers: NO_STORE });
  const me = (await upstream.json()) as { name: string; role: string };
  const expiresAt = new Date(Date.now() + STAFF_MAX_AGE * 1000).toISOString();
  const res = NextResponse.json(
    { authenticated: true, role: me.role, name: me.name, expiresAt },
    { headers: NO_STORE },
  );
  setStaffCookies(res, token, { name: me.name, role: me.role }, req.url);
  return res;
}
