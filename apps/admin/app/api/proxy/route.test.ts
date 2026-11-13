import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { GET, POST } from "./[...path]/route";

const API = "http://localhost:4000";
const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });
const COOKIE = `ap_staff=tok1; ap_staff_meta=${encodeURIComponent(JSON.stringify({ name: "A", role: "owner", exp: 1 }))}`;

function req(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost:3100${url}`, init);
}

describe("admin proxy", () => {
  it("forwards only admin/v1", async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${API}/admin/v1/overview`, ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    const ok = await GET(
      req("/api/proxy/admin/v1/overview", { headers: { cookie: COOKIE } }),
      ctx(["admin", "v1", "overview"]),
    );
    expect(ok.status).toBe(200);
    expect(auth).toBe("Bearer tok1");
    expect(ok.headers.get("cache-control")).toBe("no-store");

    for (const p of [["v1", "me"], ["admin", "other"], ["admin", "v1", "..", "x"], ["health"]]) {
      const res = await GET(req(`/api/proxy/${p.join("/")}`, { headers: { cookie: COOKIE } }), ctx(p));
      expect(res.status).toBe(404);
    }
  });

  it("re-issues cookie on success", async () => {
    server.use(http.get(`${API}/admin/v1/overview`, () => HttpResponse.json({ ok: true })));
    const res = await GET(
      req("/api/proxy/admin/v1/overview", { headers: { cookie: COOKIE } }),
      ctx(["admin", "v1", "overview"]),
    );
    const cookies = res.headers.getSetCookie();
    const staff = cookies.find((c) => c.startsWith("ap_staff="))!;
    expect(staff).toMatch(/ap_staff=tok1/);
    expect(staff).toMatch(/Max-Age=1800/i);
    expect(staff).toMatch(/SameSite=strict/i);
    expect(cookies.some((c) => c.startsWith("ap_staff_meta="))).toBe(true);
  });

  it("passes the body through byte-for-byte", async () => {
    server.use(
      http.get(
        `${API}/admin/v1/audit/export.csv`,
        () => new HttpResponse("a,b\n১,২\n", { headers: { "content-type": "text/csv" } }),
      ),
    );
    const res = await GET(
      req("/api/proxy/admin/v1/audit/export.csv", { headers: { cookie: COOKIE } }),
      ctx(["admin", "v1", "audit", "export.csv"]),
    );
    expect(res.headers.get("content-type")).toBe("text/csv");
    expect(await res.text()).toBe("a,b\n১,২\n");
  });

  it("clears cookie and 401 on upstream 401", async () => {
    server.use(http.get(`${API}/admin/v1/overview`, () => HttpResponse.json({}, { status: 401 })));
    const res = await GET(
      req("/api/proxy/admin/v1/overview", { headers: { cookie: COOKIE } }),
      ctx(["admin", "v1", "overview"]),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("session_expired");
    const staff = res.headers.getSetCookie().find((c) => c.startsWith("ap_staff="))!;
    expect(staff).toMatch(/Max-Age=0/i);
  });

  it("rejects POST without csrf header", async () => {
    const res = await POST(
      req("/api/proxy/admin/v1/families/1/suspend", { method: "POST", body: "{}", headers: { cookie: COOKIE } }),
      ctx(["admin", "v1", "families", "1", "suspend"]),
    );
    expect(res.status).toBe(403);
  });

  it("rejects POST from another origin", async () => {
    const res = await POST(
      req("/api/proxy/admin/v1/families/1/suspend", {
        method: "POST",
        body: "{}",
        headers: { cookie: COOKIE, "x-ap-csrf": "1", origin: "https://evil.example" },
      }),
      ctx(["admin", "v1", "families", "1", "suspend"]),
    );
    expect(res.status).toBe(403);
  });

  it("401 session_expired without a cookie", async () => {
    const res = await GET(req("/api/proxy/admin/v1/overview"), ctx(["admin", "v1", "overview"]));
    expect(res.status).toBe(401);
  });
});
