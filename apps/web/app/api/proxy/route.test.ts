import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { _resetRefreshCache } from "@/lib/auth/refresh";
import { GET, POST } from "./[...path]/route";

const API = "http://localhost:4000";
const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

function req(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost:3000${url}`, init);
}

beforeEach(() => _resetRefreshCache());

describe("API proxy", () => {
  it("adds Bearer from cookie", async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${API}/v1/me`, ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    const res = await GET(req("/api/proxy/v1/me", { headers: { cookie: "ap_at=tok1; ap_rt=r1" } }), ctx(["v1", "me"]));
    expect(res.status).toBe(200);
    expect(auth).toBe("Bearer tok1");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("retries once after 401 with rotated cookies", async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${API}/v1/me`, ({ request }) => {
        const a = request.headers.get("authorization") ?? "";
        seen.push(a);
        return a === "Bearer fresh" ? HttpResponse.json({ ok: true }) : HttpResponse.json({}, { status: 401 });
      }),
      http.post(`${API}/v1/auth/refresh`, () => HttpResponse.json({ accessToken: "fresh", refreshToken: "r2" })),
    );
    const res = await GET(req("/api/proxy/v1/me", { headers: { cookie: "ap_at=old; ap_rt=r1" } }), ctx(["v1", "me"]));
    expect(res.status).toBe(200);
    expect(seen).toEqual(["Bearer old", "Bearer fresh"]);
    const cookies = res.headers.getSetCookie().join("\n");
    expect(cookies).toMatch(/ap_at=fresh/);
    expect(cookies).toMatch(/ap_rt=r2/);
    expect(cookies).toMatch(/HttpOnly/i);
  });

  it("returns session_expired when refresh fails", async () => {
    server.use(
      http.get(`${API}/v1/me`, () => HttpResponse.json({}, { status: 401 })),
      http.post(`${API}/v1/auth/refresh`, () => HttpResponse.json({}, { status: 401 })),
    );
    const res = await GET(req("/api/proxy/v1/me", { headers: { cookie: "ap_at=old; ap_rt=r1" } }), ctx(["v1", "me"]));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("session_expired");
  });

  it("rejects POST without x-ap-csrf", async () => {
    const res = await POST(
      req("/api/proxy/v1/x", { method: "POST", body: "{}", headers: { cookie: "ap_at=t" } }),
      ctx(["v1", "x"]),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("csrf");
  });

  it("rejects non-v1 paths", async () => {
    const res = await GET(
      req("/api/proxy/admin/v1/me", { headers: { cookie: "ap_at=t" } }),
      ctx(["admin", "v1", "me"]),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });
});
