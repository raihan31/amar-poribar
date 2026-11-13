import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { server } from "@/mocks/server";
import { FamilyContext, type FamilyValue } from "@/components/shell/useFamily";
import { I18nProvider } from "@/lib/i18n/provider";
import { translate } from "@/lib/i18n/useT";
import SettingsPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const T = (k: Parameters<typeof translate>[1]) => translate("bn", k);
const PREFS = {
  kinds: {
    budget_threshold: true,
    nudge: true,
    message: true,
    daily_reminder: true,
    bill_due: true,
    call_missed: true,
  },
  quietStart: "22:00",
  quietEnd: "06:00",
  dailyReminderTime: "21:00",
  dailyReminderEnabled: true,
  hidePresence: false,
};

function setup() {
  const puts: unknown[] = [];
  server.use(
    http.get("*/api/proxy/v1/me/notification-preferences", () => HttpResponse.json(PREFS)),
    http.put("*/api/proxy/v1/me/notification-preferences", async ({ request }) => {
      puts.push(await request.json());
      return HttpResponse.json(PREFS);
    }),
  );
  const family = { id: "f1", name: "রহিম পরিবার", role: "owner" as const };
  const value: FamilyValue = { family, families: [family], role: "owner", switchFamily: () => {}, me: { id: "u1" } };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <I18nProvider initial={{ locale: "bn", numerals: "bn", simple: false }}>
        <FamilyContext.Provider value={value}>
          <SettingsPage />
        </FamilyContext.Provider>
      </I18nProvider>
    </QueryClientProvider>,
  );
  return puts;
}

describe("settings page", () => {
  it("simple mode toggles data-simple and persists", async () => {
    setup();
    await screen.findByRole("checkbox", { name: T("set.reminder") });
    const box = screen.getByRole("checkbox", { name: T("set.simple") });
    await userEvent.click(box);
    expect(document.documentElement.getAttribute("data-simple")).toBe("1");
    await waitFor(() => expect(document.cookie).toContain("ap_simple=1"));
    await userEvent.click(box);
    expect(document.documentElement.hasAttribute("data-simple")).toBe(false);
    await waitFor(() => expect(document.cookie).toContain("ap_simple=0"));
  });

  it("failed save rolls back", async () => {
    setup();
    server.use(http.put("*/api/proxy/v1/me/notification-preferences", () => new HttpResponse(null, { status: 500 })));
    const box = await screen.findByRole("checkbox", { name: T("set.reminder") });
    await waitFor(() => expect(box).toBeChecked());
    await userEvent.click(box);
    expect(await screen.findByText(T("set.saveFailed"))).toBeInTheDocument();
    await waitFor(() => expect(box).toBeChecked());
  });

  it("saves a reminder change with PUT", async () => {
    const puts = setup();
    const box = await screen.findByRole("checkbox", { name: T("set.reminder") });
    await waitFor(() => expect(box).toBeChecked());
    await userEvent.click(box);
    await waitFor(() => expect(puts).toEqual([{ dailyReminderEnabled: false }]));
  });

  it("switching language changes labels on the page", async () => {
    setup();
    await userEvent.click(await screen.findByRole("radio", { name: "English" }));
    expect(await screen.findByText(translate("en", "set.simple"))).toBeInTheDocument();
    expect(screen.queryByText(T("set.simple"))).toBeNull();
  });
});
