import { http, HttpResponse, type HttpHandler } from "msw";
import { demoStaff } from "./fixtures";

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
  http.get("*/admin/v1/me", () => HttpResponse.json(demoStaff())),
];
