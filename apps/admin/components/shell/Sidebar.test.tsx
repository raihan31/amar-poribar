import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/audit" }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Sidebar />
    </QueryClientProvider>,
  );
}

describe("Sidebar", () => {
  it("seven items in order and aria-current", async () => {
    server.use(http.get("*/admin/v1/overview", () => HttpResponse.json({ openPrivacyRequests: 3 })));
    wrap();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/",
      "/families",
      "/privacy",
      "/plans",
      "/audit",
      "/staff",
      "/health",
    ]);
    expect(links[4]).toHaveAttribute("aria-current", "page");
    expect(links.filter((l) => l.hasAttribute("aria-current"))).toHaveLength(1);
    expect(await screen.findByLabelText("3 open")).toBeInTheDocument();
  });
});
