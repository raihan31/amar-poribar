import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Returns a 403 response when a state-changing request fails the CSRF check, else null. */
export function checkCsrf(req: NextRequest): NextResponse | null {
  if (req.method === "GET" || req.method === "HEAD") return null;
  const fail = () => NextResponse.json({ error: { code: "csrf", message: "Forbidden" } }, { status: 403 });
  if (req.headers.get("x-ap-csrf") !== "1") return fail();
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("host") ?? req.nextUrl.host;
    try {
      if (new URL(origin).host !== host) return fail();
    } catch {
      return fail();
    }
  }
  return null;
}
