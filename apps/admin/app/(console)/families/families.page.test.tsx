import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import FamiliesPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/families",
  useSearchParams: () => new URLSearchParams("q=678&plan=free&status=active&quota=over90&page=1"),
}));

describe("families page", () => {
  it("export link keeps filters", async () => {
    server.use(http.get("*/admin/v1/families", () => HttpResponse.json({ items: [], total: 1312, nextCursor: null })));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FamiliesPage />
      </QueryClientProvider>,
    );
    const link = screen.getByRole("link", { name: "Export list (CSV)" });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("/api/proxy/admin/v1/families?")).toBe(true);
    const p = new URL(href, "http://x").searchParams;
    expect(Object.fromEntries(p)).toEqual({ q: "678", plan: "free", status: "active", quota: "over90", format: "csv" });
    expect(await screen.findByText("Families · 1,312 total")).toBeInTheDocument();
  });
});
