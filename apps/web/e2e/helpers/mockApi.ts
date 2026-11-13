import type { Page, Route } from "@playwright/test";
import type { TransactionListItem } from "@amar-poribar/shared";
import { demoFamily } from "../../mocks/fixtures";

export const demo = demoFamily();

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Reply = { status?: number; body?: unknown } | ((route: Route) => Promise<void> | void);

/** `*` matches one path segment; the query string is ignored. */
function matcher(path: string): RegExp {
  const src = path
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/?]+");
  return new RegExp(`${src}$`);
}

/**
 * Answers a browser request to the BFF (`/api/proxy/...` or `/api/auth/...`) from the test, so one spec can
 * set up exactly the data it needs. Later stubs win over earlier ones. Mock-mode only.
 */
export async function stub(page: Page, method: Method, path: string, reply: Reply): Promise<void> {
  const prefix = path.startsWith("/api/") ? "" : "/api/proxy";
  const re = matcher(`${prefix}${path}`);
  await page.route(
    (url) => re.test(url.pathname),
    async (route) => {
      if (route.request().method() !== method) return route.fallback();
      if (typeof reply === "function") return reply(route);
      const status = reply.status ?? 200;
      return route.fulfill({
        status,
        contentType: "application/json",
        body: status === 204 ? "" : JSON.stringify(reply.body ?? {}),
      });
    },
  );
}

export const problem = (status: number, code: string, details?: unknown) => ({
  status,
  body: { error: { code, message: code, ...(details === undefined ? {} : { details }) } },
});

/** Draft as the server's `POST /ai/parse` returns it. */
export function draft(over: Record<string, unknown> = {}) {
  return {
    type: "expense",
    amountPaisa: 85_000,
    feePaisa: 0,
    occurredAt: new Date().toISOString(),
    categoryKey: "bazar",
    accountType: "cash",
    note: "",
    counterparty: null,
    trxId: null,
    source: "ai_text",
    confidence: 0.95,
    ...over,
  };
}

/** `n` list rows for the current month, newest first, ids from the demo family. */
export function listItems(n: number, from = 0): TransactionListItem[] {
  const now = Date.now();
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(now));
  return Array.from({ length: n }, (_, i) => {
    const x = demo.transactions[(from + i) % demo.transactions.length]!;
    const cat = demo.categories.find((c) => c.id === x.categoryId);
    const acct = demo.accounts.find((a) => a.id === x.accountId);
    const who = demo.members.find((m) => m.userId === x.paidByUserId);
    return {
      id: x.id,
      type: x.kind,
      amountPaisa: x.amountPaisa,
      feePaisa: 0,
      occurredAt: new Date(now - (from + i) * 60_000).toISOString(),
      dayKey,
      categoryId: x.categoryId,
      categoryNameBn: cat?.nameBn ?? null,
      categoryNameEn: cat?.nameEn ?? null,
      accountId: x.accountId,
      accountName: acct?.name ?? null,
      paidByUserId: x.paidByUserId,
      paidByName: who?.name ?? null,
      createdBy: x.paidByUserId,
      note: `row ${from + i + 1}`,
      counterparty: null,
      source: "manual",
      isPrivate: false,
      isMine: true,
      hasAttachment: false,
    } satisfies TransactionListItem;
  });
}
