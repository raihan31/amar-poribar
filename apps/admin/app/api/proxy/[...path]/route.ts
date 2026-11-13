import { NextResponse, type NextRequest } from "next/server";
import { setStaffCookies } from "@/lib/auth/cookies";
import { checkCsrf } from "@/lib/auth/csrf";
import { apiUrl, readMeta, readToken, sessionExpired, upstreamDown } from "@/lib/auth/session";

const FORWARD = ["content-type", "idempotency-key", "accept-language", "accept"];
const KEEP = ["content-type", "content-disposition"];

function notFound() {
  return NextResponse.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  // Only the admin API is reachable; family routes can never be called with a staff token.
  if (path[0] !== "admin" || path[1] !== "v1" || path.some((s) => s === ".." || s === ".")) return notFound();
  const blocked = checkCsrf(req);
  if (blocked) return blocked;

  const token = readToken(req);
  if (!token) return sessionExpired(req);

  const headers = new Headers();
  for (const h of FORWARD) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("authorization", `Bearer ${token}`);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const upstream = await fetch(`${apiUrl()}/${path.join("/")}${req.nextUrl.search}`, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    cache: "no-store",
  }).catch(() => null);
  if (!upstream) return upstreamDown();
  if (upstream.status === 401) return sessionExpired(req);

  const out = new Headers({ "cache-control": "no-store" });
  for (const h of KEEP) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  const res = new NextResponse(upstream.status === 204 || upstream.status === 304 ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
  // Sliding idle window: every successful call re-issues the cookies.
  if (upstream.ok) {
    const meta = readMeta(req);
    setStaffCookies(res, token, { name: meta.name ?? "", role: meta.role ?? "" }, req.url);
  }
  return res;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
