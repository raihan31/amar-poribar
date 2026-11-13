import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { TransactionDetail } from "./TransactionDetail";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const URL_ONE = "*/api/proxy/v1/families/f1/transactions/t1";
const txn = {
  id: "t1",
  type: "expense",
  amountPaisa: 85_000,
  feePaisa: 0,
  occurredAt: "2026-01-05T11:10:00.000Z",
  dayKey: "2026-01-05",
  categoryId: "c1",
  categoryNameBn: "বাজার",
  categoryNameEn: "Groceries",
  accountId: "a1",
  accountName: "ক্যাশ",
  paidByUserId: "u1",
  paidByName: "আম্মু",
  createdBy: "u1",
  note: "চাল",
  counterparty: null,
  source: "voice",
  isPrivate: false,
  isMine: true,
  hasAttachment: false,
  trxId: null,
  aiConfidence: null,
  splitGroupId: null,
  toAccountId: null,
  attachmentUrl: null,
  canEdit: true,
  canDelete: true,
  createdAt: "2026-01-05T11:10:00.000Z",
  updatedAt: "2026-01-05T11:10:00.000Z",
};

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TransactionDetail familyId="f1" txnId="t1" />
    </QueryClientProvider>,
  );
}

describe("TransactionDetail", () => {
  it("member cannot edit others' entry", async () => {
    server.use(http.get(URL_ONE, () => HttpResponse.json({ ...txn, canEdit: false, canDelete: false, isMine: false })));
    renderIt();
    expect(await screen.findByText("আপনি শুধু নিজের খরচ বদলাতে পারেন।")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "বদলান" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "মুছুন" })).toHaveAttribute("aria-disabled", "true");
  });

  it("maps a 403 on delete to the own-entries text", async () => {
    server.use(
      http.get(URL_ONE, () => HttpResponse.json(txn)),
      http.delete(URL_ONE, () => HttpResponse.json({ error: { code: "forbidden", message: "no" } }, { status: 403 })),
    );
    renderIt();
    await userEvent.click(await screen.findByRole("button", { name: "মুছুন" }));
    await userEvent.click(screen.getByRole("button", { name: "হ্যাঁ, মুছুন" }));
    expect(await screen.findByText("আপনি শুধু নিজের খরচ বদলাতে পারেন।")).toBeInTheDocument();
  });

  it("undo restores within 30 days", async () => {
    let deleted = true;
    const restore = vi.fn();
    server.use(
      http.get(URL_ONE, () =>
        deleted
          ? HttpResponse.json(
              {
                error: {
                  code: "transaction_deleted",
                  message: "x",
                  details: { restorableUntil: new Date(Date.now() + 86_400_000).toISOString() },
                },
              },
              { status: 410 },
            )
          : HttpResponse.json(txn),
      ),
      http.post(`${URL_ONE}/restore`, () => {
        restore();
        deleted = false;
        return HttpResponse.json(txn);
      }),
    );
    renderIt();
    expect(await screen.findByText("মুছে ফেলা হয়েছে। ৩০ দিন পর্যন্ত ফেরত পাবেন।")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ফেরত আনুন" }));
    await waitFor(() => expect(restore).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "মুছুন" })).toBeEnabled();
  });

  it("private row shows শুধু আমি", async () => {
    server.use(http.get(URL_ONE, () => HttpResponse.json({ ...txn, isPrivate: true })));
    renderIt();
    expect(await screen.findByText("শুধু আমি")).toBeInTheDocument();
    expect(screen.getByText("কণ্ঠ থেকে")).toBeInTheDocument();
    expect(screen.getByText("নেই (নগদ টাকা)")).toBeInTheDocument();
  });
});
