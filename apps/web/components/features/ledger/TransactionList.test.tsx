import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { FamilyContext, type FamilyValue } from "@/components/shell/useFamily";
import type { RoleName } from "@/lib/types";
import { TransactionList } from "./TransactionList";

const M1 = "11111111-1111-4111-8111-111111111111";
const M2 = "22222222-2222-4222-8222-222222222222";
const A1 = "33333333-3333-4333-8333-333333333333";

function row(i: number, over: Record<string, unknown> = {}) {
  return {
    id: `t${i}`,
    type: "expense",
    amountPaisa: 10_000 + i,
    feePaisa: 0,
    occurredAt: "2026-11-05T06:00:00.000Z",
    dayKey: "2026-11-05",
    categoryId: null,
    categoryNameBn: "বাজার ও মুদি",
    categoryNameEn: "Groceries",
    accountId: A1,
    accountName: "ক্যাশ",
    paidByUserId: M1,
    paidByName: "আম্মু",
    createdBy: M1,
    note: `আইটেম ${i}`,
    counterparty: null,
    source: "voice",
    isPrivate: false,
    isMine: true,
    hasAttachment: false,
    ...over,
  };
}

const requests: URL[] = [];

/** Serves `total` rows in stable pages; the cursor is the offset. */
function serve(total: number, over: (i: number) => Record<string, unknown> = () => ({})) {
  server.use(
    http.get("*/api/proxy/v1/families/f1/transactions", ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const limit = Number(url.searchParams.get("limit") ?? 50);
      const from = Number(url.searchParams.get("cursor") ?? 0);
      const end = Math.min(total, from + limit);
      const items = Array.from({ length: end - from }, (_, k) => row(from + k, over(from + k)));
      return HttpResponse.json({ items, nextCursor: end < total ? String(end) : null });
    }),
    http.get("*/api/proxy/v1/families/f1/members", () =>
      HttpResponse.json([
        { userId: M1, role: "owner", name: "আম্মু", phone: "01700000001" },
        { userId: M2, role: "member", name: "আব্বু", phone: "01700000002" },
      ]),
    ),
    http.get("*/api/proxy/v1/families/f1/accounts", () => HttpResponse.json([{ id: A1, name: "ক্যাশ", type: "cash" }])),
  );
}

function setup(role: RoleName = "owner") {
  const family = { id: "f1", name: "রহিম পরিবার", role };
  const value: FamilyValue = { family, families: [family], role, switchFamily: () => {}, me: { id: M1 } };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FamilyContext.Provider value={value}>
        <TransactionList />
      </FamilyContext.Provider>
    </QueryClientProvider>,
  );
}

describe("TransactionList", () => {
  beforeEach(() => {
    requests.length = 0;
    window.history.replaceState(null, "", "/list");
  });

  it("loads 3 pages of 50 for 120 rows in stable order", async () => {
    serve(120);
    setup();
    await screen.findByText("আইটেম 0");
    for (let i = 0; i < 2; i++) {
      await userEvent.click(await screen.findByRole("button", { name: "আরও দেখুন" }));
      await waitFor(() => expect(requests).toHaveLength(i + 2));
    }
    await screen.findByText("আইটেম 119");
    expect(requests).toHaveLength(3);
    expect(requests.map((r) => r.searchParams.get("cursor"))).toEqual([null, "50", "100"]);
    expect(requests.every((r) => r.searchParams.get("limit") === "50")).toBe(true);
    const names = screen.getAllByTestId("txn-name").map((n) => n.textContent);
    expect(names).toEqual(Array.from({ length: 120 }, (_, i) => `আইটেম ${i}`));
    expect(screen.queryByRole("button", { name: "আরও দেখুন" })).toBeNull();
  });

  it("filters are reflected in the URL and request", async () => {
    serve(3);
    setup();
    await screen.findByText("আইটেম 0");
    await userEvent.click(await screen.findByRole("button", { name: "আব্বু" }));
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("memberId")).toBe(M2));
    expect(window.location.search).toContain(`member=${M2}`);
    await userEvent.click(screen.getByRole("button", { name: "ক্যাশ" }));
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("accountId")).toBe(A1));
    expect(window.location.search).toContain(`account=${A1}`);
    await userEvent.click(screen.getByRole("button", { name: "সবাই" }));
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("memberId")).toBeNull());
    expect(window.location.search).not.toContain("member=");
  });

  it("private rows show lock and label", async () => {
    serve(2, (i) => (i === 0 ? { isPrivate: true } : {}));
    setup();
    await screen.findByText("আইটেম 0");
    expect(screen.getAllByText("শুধু আপনি দেখছেন")).toHaveLength(1);
  });

  it("empty state offers add", async () => {
    serve(0);
    setup();
    expect(await screen.findByText("এই মাসে কিছু লেখা হয়নি।")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "+ নতুন খরচ লিখুন" }).length).toBeGreaterThan(0);
  });

  it("viewers see the read-only note instead of add", async () => {
    serve(1);
    setup("viewer");
    await screen.findByText("আইটেম 0");
    expect(screen.getByText("আপনি শুধু দেখতে পারবেন।")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "+ নতুন খরচ লিখুন" })).toBeNull();
  });
});
