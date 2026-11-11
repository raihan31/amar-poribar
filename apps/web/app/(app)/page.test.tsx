import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { FamilyContext, type FamilyValue } from "@/components/shell/useFamily";
import { I18nProvider } from "@/lib/i18n/provider";
import type { RoleName } from "@/lib/types";
import HomePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function setup(role: RoleName, simple = false) {
  const family = { id: "f1", name: "রহিম পরিবার", role };
  const value: FamilyValue = {
    family,
    families: [family],
    role,
    switchFamily: () => {},
    me: { id: "u1", name: "শাথী" },
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider initial={{ locale: "bn", numerals: "bn", simple }}>
        <FamilyContext.Provider value={value}>
          <HomePage />
        </FamilyContext.Provider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("home page", () => {
  it("viewer has no speak button", async () => {
    setup("viewer");
    expect(await screen.findByText("আপনি শুধু দেখতে পারবেন।")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "বলে খরচ লিখুন" })).toBeNull();
    expect(screen.queryByRole("link", { name: /জানান$/ })).toBeNull();
  });

  it("member sees the speak button and tiles", async () => {
    vi.stubGlobal("SpeechRecognition", class {});
    setup("member");
    expect(await screen.findByRole("link", { name: "বলে খরচ লিখুন" })).toHaveAttribute(
      "href",
      "/add/voice?autostart=1",
    );
    expect(screen.getByRole("link", { name: "কম্পন" })).toHaveAttribute("href", "/buzz");
    expect(screen.getByRole("button", { name: "সেটিং" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("simple mode renders HomeSimple", async () => {
    setup("member", true);
    expect(await screen.findByText("সাধারণ মোডে যান")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "বলুন" })).toBeInTheDocument();
    expect(screen.getByText("মাসের কথা শুনুন")).toBeInTheDocument();
    expect(screen.queryByText("বলে খরচ লিখুন")).toBeNull();
  });
});
