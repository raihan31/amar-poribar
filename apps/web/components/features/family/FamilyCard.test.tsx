import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { server } from "@/mocks/server";
import { FamilyProvider } from "@/components/shell/FamilyProvider";
import { FamilyContext } from "@/components/shell/useFamily";
import { translate } from "@/lib/i18n/useT";
import { qk } from "@/lib/api/queryKeys";
import type { Family } from "@/lib/types";
import { FamilyCard } from "./FamilyCard";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const families: Array<Family & { memberCount: number }> = [
  { id: "a", name: "রহিম পরিবার", role: "owner", memberCount: 5 },
  { id: "b", name: "দাদা-দাদির বাড়ি", role: "member", memberCount: 4 },
];

describe("FamilyCard", () => {
  beforeEach(() => {
    document.cookie = "ap_fid=a; path=/";
    push.mockClear();
  });

  it("switching sets ap_fid and clears cache", async () => {
    server.use(http.get("*/api/proxy/v1/me", () => HttpResponse.json({ user: { id: "u1" }, families })));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(qk.family("a").members(), [{ userId: "x" }]);
    qc.setQueryData(qk.family("b").members(), [{ userId: "y" }]);
    render(
      <QueryClientProvider client={qc}>
        <FamilyProvider>
          <FamilyCard family={families[1]!} active={false} />
        </FamilyProvider>
      </QueryClientProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /দাদা-দাদির বাড়ি/ }));
    await waitFor(() => expect(document.cookie).toContain("ap_fid=b"));
    expect(qc.getQueryData(qk.family("a").members())).toBeUndefined();
    expect(qc.getQueryData(qk.family("b").members())).toBeDefined();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("shows the active marker and badges", () => {
    const qc = new QueryClient();
    const family = { id: "a", name: "রহিম পরিবার", role: "owner" as const };
    render(
      <QueryClientProvider client={qc}>
        <FamilyContext.Provider value={{ family, families: [family], role: "owner", switchFamily: () => {}, me: null }}>
          <FamilyCard family={families[0]!} active unread={3} budgetAlerts={1} />
        </FamilyContext.Provider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(translate("bn", "sw.active"))).toBeInTheDocument();
    expect(screen.getByText(translate("bn", "sw.budgets", { n: "১" }))).toBeInTheDocument();
  });
});
