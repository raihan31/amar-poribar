import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { ApiProblem, loginUrl, onSessionExpired } from "./errors";
import { api } from "./client";

afterEach(() => onSessionExpired(null));

describe("admin api client", () => {
  it("sends the csrf header", async () => {
    let csrf: string | null = null;
    server.use(
      http.get("*/api/proxy/admin/v1/overview", ({ request }) => {
        csrf = request.headers.get("x-ap-csrf");
        return HttpResponse.json({ ok: true });
      }),
    );
    await api("/admin/v1/overview");
    expect(csrf).toBe("1");
  });
  it("throws ApiProblem and notifies once on session_expired", async () => {
    const fn = vi.fn();
    onSessionExpired(fn);
    server.use(
      http.get("*/api/proxy/admin/v1/overview", () =>
        HttpResponse.json({ error: { code: "session_expired", message: "x" } }, { status: 401 }),
      ),
    );
    await expect(api("/admin/v1/overview")).rejects.toBeInstanceOf(ApiProblem);
    await expect(api("/admin/v1/overview")).rejects.toBeInstanceOf(ApiProblem);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(loginUrl("/families?x=1")).toBe("/login?next=%2Ffamilies%3Fx%3D1");
  });
});
