import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { META_COOKIE, STAFF_COOKIE, clearStaffCookies, type StaffMeta } from "./cookies";

export function apiUrl(): string {
  return (process.env.API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

export function readToken(req: NextRequest): string | undefined {
  return req.cookies.get(STAFF_COOKIE)?.value;
}

export function readMeta(req: NextRequest): Partial<StaffMeta> {
  const raw = req.cookies.get(META_COOKIE)?.value;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<StaffMeta>;
  } catch {
    return {};
  }
}

export function sessionExpired(req?: NextRequest): NextResponse {
  const res = NextResponse.json(
    { error: { code: "session_expired", message: "Session expired" } },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
  clearStaffCookies(res, req?.url);
  return res;
}

export function upstreamDown(): NextResponse {
  return NextResponse.json({ error: { code: "upstream_unavailable" } }, { status: 502 });
}

/** Passes an upstream JSON response through unchanged (status and body), never cached. */
export async function passThrough(upstream: Response): Promise<NextResponse> {
  const text = await upstream.text();
  return new NextResponse(text || null, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}
