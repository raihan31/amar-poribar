import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { setStaffCookies } from "./cookies";

describe("staff cookies", () => {
  it("SameSite=Strict, httpOnly, Max-Age 1800", () => {
    const res = NextResponse.json({});
    setStaffCookies(res, "tok", { name: "A", role: "owner" }, "https://admin.example.com/x");
    const all = res.headers.getSetCookie();
    const staff = all.find((c) => c.startsWith("ap_staff="))!;
    expect(staff).toMatch(/HttpOnly/i);
    expect(staff).toMatch(/SameSite=strict/i);
    expect(staff).toMatch(/Max-Age=1800/i);
    expect(staff).toMatch(/Secure/i);
    expect(staff).toMatch(/Path=\//);
    const meta = all.find((c) => c.startsWith("ap_staff_meta="))!;
    expect(meta).not.toMatch(/HttpOnly/i);
    expect(meta).not.toContain("tok");
  });

  it("is not Secure on plain-http localhost", () => {
    const res = NextResponse.json({});
    setStaffCookies(res, "tok", { name: "A", role: "owner" }, "http://localhost:3100/x");
    expect(res.headers.getSetCookie()[0]).not.toMatch(/Secure/i);
  });
});
