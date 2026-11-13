import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { server } from "@/mocks/server";
import ConsentPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }),
}));

describe("consent page", () => {
  it("creates consent then family in order", async () => {
    const calls: string[] = [];
    let consentBody: unknown;
    server.use(
      http.get("*/api/proxy/v1/me", () => HttpResponse.json({ user: { id: "u1" }, families: [] })),
      http.get("*/api/proxy/v1/policy", () => HttpResponse.json({ version: "2026-01", text: "x" })),
      http.post("*/api/proxy/v1/me/consents", async ({ request }) => {
        calls.push("consent");
        consentBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
      http.post("*/api/proxy/v1/families", () => {
        calls.push("family");
        return HttpResponse.json({ id: "f9", name: "রহিম পরিবার", role: "owner" }, { status: 201 });
      }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ConsentPage />
      </QueryClientProvider>,
    );
    await userEvent.type(screen.getByPlaceholderText("যেমন: রহিম পরিবার"), "রহিম পরিবার");
    await userEvent.click(screen.getByRole("checkbox", { name: "আমি রাজি আছি" }));
    await userEvent.click(screen.getByRole("button", { name: "পরিবার তৈরি করুন" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(calls).toEqual(["consent", "family"]);
    expect(consentBody).toEqual({ kind: "privacy", version: "2026-01", locale: "bn" });
    expect(document.cookie).toContain("ap_fid=f9");
  });
});
