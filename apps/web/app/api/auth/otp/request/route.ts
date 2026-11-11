import { NextResponse, type NextRequest } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { apiUrl } from "@/lib/auth/refresh";

export async function POST(req: NextRequest) {
  const blocked = checkCsrf(req);
  if (blocked) return blocked;
  const upstream = await fetch(`${apiUrl()}/v1/auth/otp/request`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept-language": req.headers.get("accept-language") ?? "bn",
    },
    body: await req.text(),
    cache: "no-store",
  });
  return new NextResponse(upstream.status === 204 ? null : await upstream.text(), {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}
