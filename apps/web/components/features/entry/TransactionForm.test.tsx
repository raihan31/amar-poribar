import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetOutboxMemory } from "@/lib/entry/outbox";
import { server } from "@/mocks/server";
import type { Account, Category, Member } from "@/lib/types";
import { TransactionForm } from "./TransactionForm";

const categories: Category[] = [
  {
    id: "00000000-0000-4000-8000-0000000000c1",
    key: "bazar",
    kind: "expense",
    nameBn: "বাজার",
    nameEn: "Groceries",
    icon: "🛒",
  },
  {
    id: "00000000-0000-4000-8000-0000000000c2",
    key: "salary",
    kind: "income",
    nameBn: "বেতন",
    nameEn: "Salary",
    icon: "💼",
  },
];
const accounts: Account[] = [
  { id: "00000000-0000-4000-8000-0000000000a1", name: "ক্যাশ", type: "cash" },
  { id: "00000000-0000-4000-8000-0000000000a2", name: "বিকাশ", type: "bkash" },
];
const members: Member[] = [
  { userId: "00000000-0000-4000-8000-0000000000b1", role: "owner", name: "আম্মু", phone: "01" },
];
const URL_TXN = "*/api/proxy/v1/families/f1/transactions";

function renderForm(extra: Partial<Parameters<typeof TransactionForm>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TransactionForm
        familyId="f1"
        meId={members[0]!.userId}
        canPickMember
        categories={categories}
        accounts={accounts}
        members={members}
        {...extra}
      />
    </QueryClientProvider>,
  );
}

function setOnline(v: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);
}

beforeEach(() => resetOutboxMemory());
afterEach(() => vi.restoreAllMocks());

describe("TransactionForm", () => {
  it("amount 850 shows আটশো পঞ্চাশ টাকা", async () => {
    renderForm();
    await userEvent.type(screen.getByRole("textbox", { name: "কত টাকা?" }), "850");
    expect(screen.getByText("আটশো পঞ্চাশ টাকা")).toBeInTheDocument();
  });

  it("private toggle sends isPrivate", async () => {
    let body: Record<string, unknown> = {};
    let key: string | null = null;
    server.use(
      http.post(URL_TXN, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        key = request.headers.get("Idempotency-Key");
        return HttpResponse.json({ id: body.id }, { status: 201 });
      }),
    );
    const onSaved = vi.fn();
    renderForm({ onSaved });
    await userEvent.type(screen.getByRole("textbox", { name: "কত টাকা?" }), "850");
    await userEvent.click(screen.getByRole("switch", { name: /ব্যক্তিগত/ }));
    await userEvent.click(screen.getByRole("button", { name: "রাখুন" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(body.isPrivate).toBe(true);
    expect(body.amountPaisa).toBe(85_000);
    expect(body.type).toBe("expense");
    expect(typeof body.id).toBe("string");
    expect(key).toBe(body.id);
  });

  it("offline submit queues and flushes on online", async () => {
    const posted: Array<Record<string, unknown>> = [];
    server.use(
      http.post(URL_TXN, async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    setOnline(false);
    renderForm();
    await userEvent.type(screen.getByRole("textbox", { name: "কত টাকা?" }), "120");
    await userEvent.click(screen.getByRole("button", { name: "রাখুন" }));
    expect(await screen.findByText("জমা থাকল, ইন্টারনেট এলে যাবে")).toBeInTheDocument();
    expect(posted).toHaveLength(0);

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]!.amountPaisa).toBe(12_000);
  });

  it("income hides account 'who paid' label change", async () => {
    renderForm();
    expect(screen.getByText("কে দিলেন?")).toBeInTheDocument();
    expect(screen.getByText("কোন অ্যাকাউন্ট থেকে?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "আয়" }));
    expect(screen.getByText("কে পেলেন?")).toBeInTheDocument();
    expect(screen.getByText("কোন অ্যাকাউন্টে?")).toBeInTheDocument();
    expect(screen.queryByText("কে দিলেন?")).toBeNull();
  });

  it("selected account chip shows a check", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /বিকাশ/ }));
    expect(screen.getByRole("button", { name: /বিকাশ/ })).toHaveTextContent("✓");
    expect(screen.getByRole("button", { name: /ক্যাশ/ })).not.toHaveTextContent("✓");
  });
});
