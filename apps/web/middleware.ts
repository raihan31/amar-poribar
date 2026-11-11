import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (req.cookies.has("ap_at") || req.cookies.has("ap_rt")) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!api|_next|welcome|login|join|session-expired|manifest\\.webmanifest|sw\\.js|favicon\\.ico|icons|.*\\.(?:png|svg|jpg|jpeg|ico|webp)$).*)",
  ],
};
