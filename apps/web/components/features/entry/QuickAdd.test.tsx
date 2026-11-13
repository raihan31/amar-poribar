import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@amar-poribar/shared";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { QuickAdd } from "./QuickAdd";

const instances: FakeRecognition[] = [];
class FakeRecognition {
  lang = "";
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    instances.push(this);
  }
  start() {}
  stop() {}
}

beforeEach(() => {
  (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
});
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  vi.unstubAllGlobals();
  instances.length = 0;
});

describe("QuickAdd", () => {
  it("voice transcript is parsed and read back", async () => {
    let sentText = "";
    server.use(
      http.post("http://localhost:3000/api/proxy/v1/families/f1/ai/parse", async ({ request }) => {
        sentText = ((await request.json()) as { text: string }).text;
        return HttpResponse.json({
          drafts: [
            {
              type: "expense",
              amountPaisa: 50_000,
              feePaisa: 0,
              occurredAt: "2026-03-01T00:00:00.000Z",
              categoryKey: "grocery",
              accountType: "cash",
              note: "বাজার",
              counterparty: null,
              trxId: null,
              source: "ai_text",
              confidence: 0.9,
            },
          ],
        });
      }),
    );
    render(
      <QuickAdd
        family={{ id: "f1", name: "F", role: "owner" }}
        categories={[{ id: "c1", key: "grocery", kind: "expense", nameBn: "বাজার", nameEn: "Grocery", icon: "🛒" }]}
        accounts={[]}
        onSaved={() => {}}
        onError={() => {}}
      />,
    );
    const mic = screen.getByRole("button", { name: t("tapToSpeak") });
    await waitFor(() => expect(mic).toBeEnabled());
    await userEvent.click(mic);
    act(() => instances[0]!.onresult!({ results: { length: 1, 0: { 0: { transcript: "বাজার ৫০০ টাকা" } } } }));

    await waitFor(() => expect(globalThis.__spoken.length).toBe(1));
    expect(sentText).toBe("বাজার ৫০০ টাকা");
    expect(globalThis.__spoken[0]).toContain("বাজার");
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });
});
