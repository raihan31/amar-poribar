import { NextResponse, type NextRequest } from "next/server";
import { setSession, type Tokens } from "@/lib/auth/cookies";
import { checkCsrf } from "@/lib/auth/csrf";
import { apiUrl, refreshSession } from "@/lib/auth/refresh";
import { readSession, sessionExpired } from "@/lib/auth/session";

const FORWARD = ["content-type", "idempotency-key", "accept-language", "accept"];
const KEEP = ["content-type", "content-disposition"];

function notFound() {
  return NextResponse.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (path[0] !== "v1" || path.some((s) => s === ".." || s === ".")) return notFound();
  const blocked = checkCsrf(req);
  if (blocked) return blocked;

  const { at, rt } = readSession(req);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  // Buffered (not streamed) so the request can be replayed after a token refresh.
  const body = hasBody ? await req.arrayBuffer() : undefined;
  const target = `${apiUrl()}/${path.join("/")}${req.nextUrl.search}`;

  const call = (token: string | undefined) => {
    const headers = new Headers();
    for (const h of FORWARD) {
      const v = req.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (token) headers.set("authorization", `Bearer ${token}`);
    return fetch(target, { method: req.method, headers, body, cache: "no-store" });
  };

  let upstream = await call(at);
  let rotated: Tokens | null = null;
  if (upstream.status === 401) {
    if (!rt) return sessionExpired(req);
    try {
      rotated = await refreshSession(rt);
    } catch {
      return sessionExpired(req);
    }
    upstream = await call(rotated.accessToken);
  }

  const headers = new Headers({ "cache-control": "no-store" });
  for (const h of KEEP) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  const res = new NextResponse(upstream.status === 204 || upstream.status === 304 ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
  if (rotated) setSession(res, rotated, req.url);
  return res;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
