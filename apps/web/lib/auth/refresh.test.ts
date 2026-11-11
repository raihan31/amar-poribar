import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { POST as refreshRoute } from "@/app/api/auth/refresh/route";
import { _resetRefreshCache, refreshSession } from "./refresh";

const API = "http://localhost:4000";

beforeEach(() => _resetRefreshCache());

describe("refreshSession", () => {
  it("parallel callers share one refresh call", async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/v1/auth/refresh`, async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json({ accessToken: "at2", refreshToken: "rt2" });
      }),
    );
    const [a, b] = await Promise.all([refreshSession("rt1"), refreshSession("rt1")]);
    expect(calls).toBe(1);
    expect(a).toEqual({ accessToken: "at2", refreshToken: "rt2" });
    expect(b).toBe(a);
  });

  it("failed refresh clears cookies", async () => {
    server.use(http.post(`${API}/v1/auth/refresh`, () => HttpResponse.json({ error: {} }, { status: 401 })));
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: { "x-ap-csrf": "1", cookie: "ap_rt=dead" },
    });
    const res = await refreshRoute(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("session_expired");
    const cookies = res.headers.getSetCookie().join("\n");
    expect(cookies).toMatch(/ap_at=;/);
    expect(cookies).toMatch(/ap_rt=;/);
    expect(cookies).toMatch(/Max-Age=0/i);
  });
});
