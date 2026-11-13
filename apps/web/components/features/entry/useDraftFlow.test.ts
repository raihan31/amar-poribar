import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionDraft } from "@amar-poribar/shared";
import { server } from "@/mocks/server";
import type { Account, Category } from "@/lib/types";
import { useDraftFlow } from "./useDraftFlow";

const PARSE = "*/api/proxy/v1/families/f1/ai/parse";
const TXN = "*/api/proxy/v1/families/f1/transactions";

const categories: Category[] = [
  { id: "c1", key: "grocery", kind: "expense", nameBn: "বাজার ও মুদি", nameEn: "Groceries", icon: null },
  { id: "c2", key: "transport", kind: "expense", nameBn: "যাতায়াত", nameEn: "Transport", icon: null },
];
const accounts: Account[] = [{ id: "a1", name: "নগদ", type: "cash" }];

const draft = (over: Partial<TransactionDraft> = {}): TransactionDraft => ({
  type: "expense",
  amountPaisa: 85_000,
  feePaisa: 0,
  occurredAt: "2026-11-13T04:00:00.000Z",
  categoryKey: "grocery",
  accountType: "cash",
  note: "বাজার",
  counterparty: null,
  trxId: null,
  source: "ai_text",
  confidence: 0.9,
  ...over,
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

const setup = () => renderHook(() => useDraftFlow({ familyId: "f1", categories, accounts }), { wrapper });

beforeEach(() => {
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("useDraftFlow", () => {
  it("unknown category moves to needsCategory", async () => {
    server.use(http.post(PARSE, () => HttpResponse.json({ drafts: [draft({ categoryKey: null })], usedAi: false })));
    const { result } = setup();
    expect(result.current.status).toBe("idle");
    await act(() => result.current.submit("৫০০ টাকা", true));
    expect(result.current.status).toBe("needsCategory");
    expect(result.current.view?.category).toBeNull();

    act(() => result.current.pickCategory("transport"));
    expect(result.current.view?.draft.categoryKey).toBe("transport");
    expect(result.current.view?.category?.id).toBe("c2");
  });

  it("known category goes to readback", async () => {
    server.use(http.post(PARSE, () => HttpResponse.json({ drafts: [draft()], usedAi: false })));
    const { result } = setup();
    await act(() => result.current.submit("বাজার ৮৫০", true));
    expect(result.current.status).toBe("readback");
    expect(result.current.view?.category?.nameBn).toBe("বাজার ও মুদি");
  });

  it("voice drafts are marked source=voice", async () => {
    let saved: Record<string, unknown> = {};
    server.use(
      http.post(PARSE, () => HttpResponse.json({ drafts: [draft()], usedAi: false })),
      http.post(TXN, async ({ request }) => {
        saved = (await request.json()) as Record<string, unknown>;
        expect(request.headers.get("Idempotency-Key")).toBeTruthy();
        return HttpResponse.json({ id: "t1" }, { status: 201 });
      }),
    );
    const { result } = setup();
    await act(() => result.current.submit("বাজার ৮৫০", true));
    expect(result.current.view?.draft.source).toBe("voice");
    let ok = false;
    await act(async () => {
      ok = await result.current.save();
    });
    expect(ok).toBe(true);
    expect(saved).toMatchObject({ source: "voice", categoryId: "c1", accountId: "a1", amountPaisa: 85_000 });

    // Typed text keeps the server's source.
    await act(() => result.current.submit("বাজার ৮৫০", false));
    expect(result.current.view?.draft.source).toBe("ai_text");
  });

  it("ai_quota shows plans link", async () => {
    server.use(
      http.post(PARSE, () => HttpResponse.json({ error: { code: "ai_quota", message: "limit" } }, { status: 429 })),
    );
    const { result } = setup();
    await act(() => result.current.submit("বাজার ৮৫০", true));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.quota).toBe(true);
    // Text entry keeps working afterwards.
    server.use(http.post(PARSE, () => HttpResponse.json({ drafts: [draft()], usedAi: false })));
    await act(() => result.current.submit("বাজার ৮৫০", false));
    expect(result.current.status).toBe("readback");
    expect(result.current.quota).toBe(false);
  });

  it("empty parse result is an error, not a blank screen", async () => {
    server.use(http.post(PARSE, () => HttpResponse.json({ drafts: [], usedAi: false })));
    const { result } = setup();
    await act(() => result.current.submit("???", true));
    expect(result.current.status).toBe("error");
    expect(result.current.quota).toBe(false);
  });
});
