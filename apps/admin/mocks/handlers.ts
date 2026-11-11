import { http, HttpResponse, type HttpHandler } from "msw";
import { demoStaff } from "./fixtures";

/** One handler per route a screen uses; later tasks add the staff and admin routes. */
export const handlers: HttpHandler[] = [
  http.get("*/api/staff/session", () => HttpResponse.json({ authenticated: true, ...demoStaff() })),
];
