import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { FamilyContext, type FamilyValue } from "@/components/shell/useFamily";
import { translate } from "@/lib/i18n/useT";
import type { RoleName } from "@/lib/types";
import BudgetPage from "./page";

const budgets = [
  {
    categoryId: null,
    nameBn: "পুরো পরিবার",
    nameEn: "Whole family",
    limitPaisa: 5_000_000,
    spentPaisa: 4_250_000,
    level: "warning",
    inherited: true,
  },
  {
    categoryId: "c1",
    nameBn: "বাজার ও মুদি",
    nameEn: "Groceries",
    limitPaisa: 1_000_000,
    spentPaisa: 1_050_000,
    level: "exceeded",
    inherited: false,
  },
  {
    categoryId: "c2",
    nameBn: "যাতায়াত",
    nameEn: "Transport",
    limitPaisa: 300_000,
    spentPaisa: 120_000,
    level: "ok",
    inherited: false,
  },
];
const members = [
  { userId: "u1", role: "owner", name: "আব্বু", phone: "01700000001" },
  { userId: "u2", role: "admin", name: "আম্মু", phone: "01700000002" },
];

function setup(role: RoleName = "owner") {
  server.use(
    http.get("*/api/proxy/v1/families/f1/budgets", () => HttpResponse.json({ budgets })),
    http.get("*/api/proxy/v1/families/f1/members", () => HttpResponse.json(members)),
    http.get("*/api/proxy/v1/families/f1/categories", () => HttpResponse.json([])),
    http.get("*/api/proxy/v1/families/f1/festival-budgets", () =>
      HttpResponse.json([
        {
          id: "fe1",
          name: "ঈদুল আযহা",
          startsOn: "2026-06-15",
          endsOn: "2026-06-20",
          limitPaisa: 2_000_000,
          spentPaisa: 0,
          level: "ok",
        },
      ]),
    ),
  );
  const family = { id: "f1", name: "রহিম পরিবার", role };
  const value: FamilyValue = { family, families: [family], role, switchFamily: () => {}, me: { id: "u1" } };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FamilyContext.Provider value={value}>
        <BudgetPage />
      </FamilyContext.Provider>
    </QueryClientProvider>,
  );
}

describe("budget page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
  });

  it("renders the budget cards and the festival card from fixtures", async () => {
    setup();
    expect(await screen.findByText("বাজার ও মুদি")).toBeInTheDocument();
    expect(screen.getByText("পুরো পরিবার")).toBeInTheDocument();
    expect(screen.getByText("যাতায়াত")).toBeInTheDocument();
    const fest = await screen.findByRole("link", { name: /ঈদুল আযহা/ });
    expect(fest).toHaveAttribute("href", "/festival/new");
    expect(screen.getByRole("link", { name: "আম্মুকে কম্পন দিন" })).toBeInTheDocument();
  });

  it("reads statuses aloud", async () => {
    setup();
    await screen.findByText("বাজার ও মুদি");
    await userEvent.click(screen.getByRole("button", { name: translate("bn", "speak") }));
    await waitFor(() => expect(globalThis.__spoken.length).toBeGreaterThan(0));
    const said = globalThis.__spoken.join(" ");
    expect(said).toContain("বাজার ও মুদি");
    expect(said).toContain(translate("bn", "bud.ok"));
  });

  it("members see no edit button", async () => {
    setup("member");
    await screen.findByText("বাজার ও মুদি");
    expect(screen.queryByRole("button", { name: translate("bn", "bud.add") })).toBeNull();
  });

  it("owner sees the add button", async () => {
    setup("owner");
    expect(await screen.findByRole("button", { name: translate("bn", "bud.add") })).toBeInTheDocument();
  });
});
