import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { translate } from "@/lib/i18n/useT";
import { AskThread } from "./AskThread";

const t = (k: Parameters<typeof translate>[1]) => translate("bn", k);
let bodies: Array<{ question: string; forSpeech?: boolean }> = [];

function fakeRecognition(transcript: string) {
  class Fake {
    lang = "";
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    start() {}
    stop() {
      this.onresult?.({ results: { 0: { 0: { transcript } }, length: 1 } });
      this.onend?.();
    }
  }
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition = Fake;
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AskThread familyId="f1" />
    </QueryClientProvider>,
  );
}

describe("AskThread", () => {
  beforeEach(() => {
    bodies = [];
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
  });
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it("spoken question is answered aloud", async () => {
    fakeRecognition("বিদ্যুৎ বিল কত?");
    server.use(
      http.post("*/api/proxy/v1/families/f1/ai/ask", async ({ request }) => {
        bodies.push((await request.json()) as { question: string; forSpeech?: boolean });
        return HttpResponse.json({ answer: "বিদ্যুৎ বিল ৳ ২,৩৪০।", usedAi: true });
      }),
    );
    setup();
    const mic = await screen.findByRole("button", { name: t("ask.mic") });
    fireEvent.pointerDown(mic);
    fireEvent.pointerUp(mic);
    expect(await screen.findByText("বিদ্যুৎ বিল কত?", { selector: ".ask-bubble--user" })).toBeInTheDocument();
    expect(await screen.findByText(/২,৩৪০/)).toBeInTheDocument();
    await waitFor(() => expect(globalThis.__spoken).toContain("বিদ্যুৎ বিল ৳ ২,৩৪০।"));
    expect(bodies[0]).toEqual({ question: "বিদ্যুৎ বিল কত?", forSpeech: true });
  });

  it("typed question is not spoken automatically", async () => {
    fakeRecognition("");
    server.use(
      http.post("*/api/proxy/v1/families/f1/ai/ask", () => HttpResponse.json({ answer: "ঠিক আছে।", usedAi: true })),
    );
    setup();
    await userEvent.click(await screen.findByRole("button", { name: t("ask.type") }));
    await userEvent.type(screen.getByRole("textbox"), "হিসাব কেমন?");
    await userEvent.click(screen.getByRole("button", { name: t("ask.send") }));
    expect(await screen.findByText("ঠিক আছে।")).toBeInTheDocument();
    expect(globalThis.__spoken).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: t("entry.listenAgain") }));
    await waitFor(() => expect(globalThis.__spoken).toContain("ঠিক আছে।"));
  });

  it("without speech recognition the text field is open at once", async () => {
    setup();
    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("ask.mic") })).toBeNull();
  });

  it("suggested question asks it", async () => {
    server.use(
      http.post("*/api/proxy/v1/families/f1/ai/ask", () => HttpResponse.json({ answer: "বিল ৳ ১০০।", usedAi: true })),
    );
    setup();
    await userEvent.click(await screen.findByRole("button", { name: t("ask.q2") }));
    expect(await screen.findByText(/৳ ১০০/)).toBeInTheDocument();
  });

  it("quota error shows plans link", async () => {
    server.use(
      http.post("*/api/proxy/v1/families/f1/ai/ask", () =>
        HttpResponse.json({ error: { code: "ai_quota", message: "limit" } }, { status: 429 }),
      ),
    );
    setup();
    await userEvent.click(await screen.findByRole("button", { name: t("ask.q1") }));
    const link = await screen.findByRole("link", { name: t("entry.seePlans") });
    expect(link).toHaveAttribute("href", "/plans");
    expect(screen.getByText(t("ask.quota"))).toBeInTheDocument();
  });

  it("plan error shows plans link", async () => {
    server.use(
      http.post("*/api/proxy/v1/families/f1/ai/ask", () =>
        HttpResponse.json({ error: { code: "plan_required", message: "plan" } }, { status: 402 }),
      ),
    );
    setup();
    await userEvent.click(await screen.findByRole("button", { name: t("ask.q1") }));
    expect(await screen.findByText(t("ask.plan"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("entry.seePlans") })).toHaveAttribute("href", "/plans");
  });
});
