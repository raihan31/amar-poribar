import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { server } from "@/mocks/server";
import { FamilyContext, type FamilyValue } from "./useFamily";
import { TabBar } from "./TabBar";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const value: FamilyValue = {
  family: { id: "f1", name: "রহিম পরিবার", role: "owner" },
  families: [{ id: "f1", name: "রহিম পরিবার", role: "owner" }],
  role: "owner",
  switchFamily: () => {},
  me: { id: "u1" },
};

function renderBar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FamilyContext.Provider value={value}>
        <TabBar />
      </FamilyContext.Provider>
    </QueryClientProvider>,
  );
}

describe("TabBar", () => {
  beforeEach(() => {
    pathname = "/";
    server.use(http.get("*/api/proxy/v1/families/:familyId/conversations", () => HttpResponse.json([])));
  });

  it("five tabs in order", () => {
    renderBar();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/", "/chat", "/list", "/budget", "/family"]);
    expect(links.map((l) => l.textContent)).toEqual(["হোম", "কথা", "তালিকা", "বাজেট", "পরিবার"]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });

  it("unread badge has Bangla aria-label", async () => {
    server.use(
      http.get("*/api/proxy/v1/families/:familyId/conversations", () =>
        HttpResponse.json([
          { id: "c1", unread: 1 },
          { id: "c2", unread: 1 },
        ]),
      ),
    );
    renderBar();
    await waitFor(() => expect(screen.getByLabelText("২টি নতুন")).toBeInTheDocument());
  });

  it("is hidden on pushed screens", () => {
    pathname = "/budget/edit";
    renderBar();
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
