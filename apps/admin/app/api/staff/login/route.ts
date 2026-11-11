import type { NextRequest } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { apiUrl, passThrough, upstreamDown } from "@/lib/auth/session";

/** Passes `{status, challengeId, otpauthUri?, secret?}` through; never sets a cookie. */
export async function POST(req: NextRequest) {
  const blocked = checkCsrf(req);
  if (blocked) return blocked;
  const upstream = await fetch(`${apiUrl()}/admin/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await req.text(),
    cache: "no-store",
  }).catch(() => null);
  return upstream ? passThrough(upstream) : upstreamDown();
}
