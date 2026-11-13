import { http, HttpResponse, type HttpHandler } from "msw";
import { overviewFixture } from "../components/overview/types";
import { demoStaff, privacyFixture, staffFixture } from "./fixtures";

/** One handler per route a screen uses; later tasks add the admin routes. */
export const handlers: HttpHandler[] = [
  http.get("*/api/staff/session", () => HttpResponse.json({ authenticated: true, ...demoStaff() })),
  http.post("*/admin/v1/auth/login", () =>
    HttpResponse.json({ status: "totp_required", challengeId: "mock-challenge" }),
  ),
  http.post("*/admin/v1/auth/totp", async ({ request }) => {
    const { code } = (await request.json()) as { code?: string };
    if (code !== "123456") {
      return HttpResponse.json({ error: { code: "totp_invalid", attemptsLeft: 4 } }, { status: 401 });
    }
    return HttpResponse.json({ token: "mock-staff-token", ...demoStaff() });
  }),
  http.post("*/admin/v1/auth/logout", () => new HttpResponse(null, { status: 204 })),
  http.get("*/admin/v1/audit", () =>
    HttpResponse.json({
      items: [
        {
          id: 214,
          at: "2026-11-11T03:12:00Z",
          staffName: "Rubel",
          action: "Suspended family",
          kind: "risky",
          familyName: "মিয়া পরিবার",
          reason: "Abuse report #4890",
        },
      ],
      nextCursor: null,
      total: 1,
      chain: { ok: true, verifiedThrough: 214 },
    }),
  ),
  http.get("*/admin/v1/staff", () => HttpResponse.json(staffFixture())),
  http.post("*/admin/v1/staff", () => HttpResponse.json({ ok: true }, { status: 201 })),
  http.patch("*/admin/v1/staff/:id", () => HttpResponse.json({ ok: true })),
  http.get("*/admin/v1/me", () => HttpResponse.json(demoStaff())),
  http.get("*/admin/v1/overview", () => HttpResponse.json(overviewFixture)),
  http.get("*/admin/v1/privacy-requests", ({ request }) => {
    const status = new URL(request.url).searchParams.get("status") ?? "open";
    const f = privacyFixture();
    return HttpResponse.json(status === "open" ? f : { items: [], counts: f.counts });
  }),
  http.post("*/admin/v1/privacy-requests/:id/advance", () => HttpResponse.json({ ok: true })),
  http.post("*/admin/v1/privacy-requests/:id/reject", () => HttpResponse.json({ ok: true })),
];
