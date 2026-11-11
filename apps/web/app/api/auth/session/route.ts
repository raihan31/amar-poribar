import { NextResponse, type NextRequest } from "next/server";
import { decodeJwt, expiresInSeconds, readSession } from "@/lib/auth/session";

export function GET(req: NextRequest) {
  const { at, rt } = readSession(req);
  const claims = decodeJwt(at);
  const live = !!claims && expiresInSeconds(at) > 0;
  // An expired access token with a refresh cookie is still a session; the proxy renews it.
  const authenticated = live || !!rt;
  return NextResponse.json(
    { authenticated, userId: claims?.sub ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
