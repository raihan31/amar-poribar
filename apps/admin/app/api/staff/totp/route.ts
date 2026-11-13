import { NextResponse, type NextRequest } from "next/server";
import { setStaffCookies } from "@/lib/auth/cookies";
import { checkCsrf } from "@/lib/auth/csrf";
import { apiUrl, passThrough, upstreamDown } from "@/lib/auth/session";

/** On success the token goes into httpOnly cookies only; the body is `{ok, role, name}`. */
export async function POST(req: NextRequest) {
  const blocked = checkCsrf(req);
  if (blocked) return blocked;
  const upstream = await fetch(`${apiUrl()}/admin/v1/auth/totp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await req.text(),
    cache: "no-store",
  }).catch(() => null);
  if (!upstream) return upstreamDown();
  if (upstream.status !== 200) return passThrough(upstream);
  const data = (await upstream.json()) as { token: string; name: string; role: string };
  const res = NextResponse.json(
    { ok: true, role: data.role, name: data.name },
    { headers: { "cache-control": "no-store" } },
  );
  setStaffCookies(res, data.token, { name: data.name, role: data.role }, req.url);
  return res;
}
