import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "@/lib/auth/cookies";
import { checkCsrf } from "@/lib/auth/csrf";
import { apiUrl } from "@/lib/auth/refresh";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(req: NextRequest) {
  const blocked = checkCsrf(req);
  if (blocked) return blocked;
  const lang = req.headers.get("accept-language") ?? "bn";
  const upstream = await fetch(`${apiUrl()}/v1/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", "accept-language": lang },
    body: await req.text(),
    cache: "no-store",
  });
  if (!upstream.ok) {
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", ...NO_STORE },
    });
  }
  const body = (await upstream.json()) as {
    accessToken: string;
    refreshToken: string;
    user?: unknown;
    families?: unknown;
  };
  let { user, families } = body;
  if (user === undefined || families === undefined) {
    // The API currently returns tokens only; read the profile with the new token.
    const me = await fetch(`${apiUrl()}/v1/me`, {
      headers: { authorization: `Bearer ${body.accessToken}`, "accept-language": lang },
      cache: "no-store",
    }).catch(() => null);
    if (me?.ok) {
      const data = (await me.json()) as { user?: unknown; families?: unknown };
      user ??= data.user;
      families ??= data.families;
    }
  }
  const res = NextResponse.json({ ok: true, user: user ?? null, families: families ?? [] }, { headers: NO_STORE });
  setSession(res, { accessToken: body.accessToken, refreshToken: body.refreshToken }, req.url);
  return res;
}
