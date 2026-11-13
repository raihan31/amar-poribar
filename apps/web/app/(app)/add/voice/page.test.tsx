import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyContext, type FamilyValue } from "@/components/shell/useFamily";
import { I18nProvider } from "@/lib/i18n/provider";
import { server } from "@/mocks/server";
import VoiceEntryPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }) }));

const instances: FakeRecognition[] = [];
class FakeRecognition {
  onresult: ((e: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    instances.push(this);
  }
  start() {}
  stop() {}
}

const F = "*/api/proxy/v1/families/f1";

beforeEach(() => {
  (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
  Object.defineProperty(window, "speechSynthesis", {
    writable: true,
    value: {
      speak: (u: { text?: string }) => globalThis.__spoken.push(u?.text ?? ""),
      cancel: () => {},
      getVoices: () => [{ lang: "bn-BD" }],
    },
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  server.use(
    http.get(`${F}/categories`, () =>
      HttpResponse.json([
        { id: "c1", key: "grocery", kind: "expense", nameBn: "বাজার ও মুদি", nameEn: "G", icon: null },
      ]),
    ),
    http.get(`${F}/accounts`, () => HttpResponse.json([{ id: "a1", name: "নগদ", type: "cash" }])),
  );
});
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  vi.unstubAllGlobals();
  instances.length = 0;
  push.mockClear();
});

describe("voice entry page", () => {
  it("fake recognition reads back 850 and saving goes home", async () => {
    let saved: Record<string, unknown> | null = null;
    server.use(
      http.post(`${F}/ai/parse`, () =>
        HttpResponse.json({
          usedAi: false,
          drafts: [
            {
              type: "expense",
              amountPaisa: 85_000,
              feePaisa: 0,
              occurredAt: new Date().toISOString(),
              categoryKey: "grocery",
              accountType: "cash",
              note: "বাজার",
              counterparty: null,
              trxId: null,
              source: "ai_text",
              confidence: 0.9,
            },
          ],
        }),
      ),
      http.post(`${F}/transactions`, async ({ request }) => {
        saved = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "t1" }, { status: 201 });
      }),
    );
    const family = { id: "f1", name: "F", role: "member" as const };
    const value: FamilyValue = { family, families: [family], role: "member", switchFamily: () => {}, me: { id: "u1" } };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <I18nProvider initial={{ locale: "bn", numerals: "bn", simple: false }}>
          <FamilyContext.Provider value={value}>
            <VoiceEntryPage />
          </FamilyContext.Provider>
        </I18nProvider>
      </QueryClientProvider>,
    );
    const mic = await screen.findByRole("button", { name: "চাপ দিয়ে বলুন" });
    await waitFor(() => expect(mic).toBeEnabled());
    await userEvent.click(mic);
    act(() =>
      instances[0]!.onresult!({
        results: { length: 1, 0: { 0: { transcript: "আজ বাজারে আটশো পঞ্চাশ টাকা ক্যাশে" } } },
      }),
    );
    expect(await screen.findByText("৳ ৮৫০")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "হ্যাঁ, রাখুন" }));
    expect(await screen.findByText("রাখা হয়েছে")).toBeInTheDocument();
    expect(saved).toMatchObject({ source: "voice", amountPaisa: 85_000, categoryId: "c1" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"), { timeout: 2000 });
  });
});
