import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { POST as login } from "./route";
import { POST as totp } from "../totp/route";

const API = "http://localhost:4000";
const post = (url: string, body: unknown, csrf = true) =>
  new NextRequest(`http://localhost:3100${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...(csrf ? { "x-ap-csrf": "1" } : {}) },
  });

describe("staff login", () => {
  it("never returns a token", async () => {
    server.use(
      http.post(`${API}/admin/v1/auth/totp`, () =>
        HttpResponse.json({ token: "SECRET-TOKEN", name: "Demo", role: "owner" }),
      ),
    );
    const res = await totp(post("/api/staff/totp", { challengeId: "c", code: "123456" }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("SECRET-TOKEN");
    expect(JSON.parse(text)).toEqual({ ok: true, role: "owner", name: "Demo" });
    const cookies = res.headers.getSetCookie();
    expect(cookies.find((c) => c.startsWith("ap_staff="))).toContain("SECRET-TOKEN");
    expect(cookies.find((c) => c.startsWith("ap_staff_meta="))).not.toContain("SECRET-TOKEN");
  });

  it("passes the challenge through without cookies", async () => {
    const res = await login(post("/api/staff/login", { email: "a@b.c", password: "x" }));
    expect(await res.json()).toEqual({ status: "totp_required", challengeId: "mock-challenge" });
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("passes lockout errors through", async () => {
    server.use(
      http.post(`${API}/admin/v1/auth/login`, () =>
        HttpResponse.json({ error: { code: "account_locked", retryAfterSeconds: 900 } }, { status: 423 }),
      ),
    );
    const res = await login(post("/api/staff/login", { email: "a@b.c", password: "x" }));
    expect(res.status).toBe(423);
    expect((await res.json()).error.retryAfterSeconds).toBe(900);
  });

  it("rejects a missing csrf header", async () => {
    const res = await login(post("/api/staff/login", {}, false));
    expect(res.status).toBe(403);
  });
});
