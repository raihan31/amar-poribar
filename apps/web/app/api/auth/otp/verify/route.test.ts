import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { POST } from "./route";

const API = "http://localhost:4000";

function verifyReq() {
  return new NextRequest("http://localhost:3000/api/auth/otp/verify", {
    method: "POST",
    headers: { "x-ap-csrf": "1", "content-type": "application/json" },
    body: JSON.stringify({ phone: "01712345678", code: "123456" }),
  });
}

describe("POST /api/auth/otp/verify", () => {
  it("sets httpOnly cookies and never returns tokens", async () => {
    server.use(
      http.post(`${API}/v1/auth/otp/verify`, () => HttpResponse.json({ accessToken: "AT", refreshToken: "RT" })),
      http.get(`${API}/v1/me`, () => HttpResponse.json({ user: { id: "u1" }, families: [{ id: "f1" }] })),
    );
    const res = await POST(verifyReq());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("AT");
    expect(text).not.toContain("RT");
    expect(JSON.parse(text)).toEqual({ ok: true, user: { id: "u1" }, families: [{ id: "f1" }] });
    const cookies = res.headers.getSetCookie();
    const at = cookies.find((c) => c.startsWith("ap_at="));
    const rt = cookies.find((c) => c.startsWith("ap_rt="));
    expect(at).toMatch(/HttpOnly/i);
    expect(at).toMatch(/Max-Age=900/i);
    expect(rt).toMatch(/HttpOnly/i);
    expect(rt).toMatch(/Max-Age=2592000/i);
  });

  it("passes error bodies and status through unchanged", async () => {
    const body = { error: { code: "otp_invalid", message: "x", details: { attemptsLeft: 2 } } };
    server.use(http.post(`${API}/v1/auth/otp/verify`, () => HttpResponse.json(body, { status: 401 })));
    const res = await POST(verifyReq());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(body);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});
