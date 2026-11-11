import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { server } from "@/mocks/server";
import { FamilyProvider } from "./FamilyProvider";
import { useFamily } from "./useFamily";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

function Show() {
  const { family, role } = useFamily();
  return <p>{`${family.id}:${role}`}</p>;
}

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FamilyProvider>
        <Show />
      </FamilyProvider>
    </QueryClientProvider>,
  );
}

function me(families: Array<{ id: string; name: string; role: string }>) {
  server.use(http.get("*/api/proxy/v1/me", () => HttpResponse.json({ user: { id: "u1" }, families })));
}

describe("FamilyProvider", () => {
  beforeEach(() => {
    replace.mockClear();
    document.cookie = "ap_fid=; max-age=0; path=/";
  });

  it("falls back to first family when cookie family is gone", async () => {
    document.cookie = "ap_fid=gone; path=/";
    me([
      { id: "a", name: "A", role: "member" },
      { id: "b", name: "B", role: "owner" },
    ]);
    renderIt();
    expect(await screen.findByText("a:member")).toBeInTheDocument();
  });

  it("uses the cookie family when still a member", async () => {
    document.cookie = "ap_fid=b; path=/";
    me([
      { id: "a", name: "A", role: "member" },
      { id: "b", name: "B", role: "owner" },
    ]);
    renderIt();
    expect(await screen.findByText("b:owner")).toBeInTheDocument();
  });

  it("no families redirects to /consent", async () => {
    me([]);
    renderIt();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/consent"));
  });
});
