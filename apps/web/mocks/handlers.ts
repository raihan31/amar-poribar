import { http, HttpResponse, type HttpHandler } from "msw";
import { demoFamily } from "./fixtures";

// server.ts binds itself here (avoids a circular import between handlers and server).
let target: { use: (...h: HttpHandler[]) => void } | null = null;
export function bindServer(s: { use: (...h: HttpHandler[]) => void }) {
  target = s;
}

const demo = demoFamily();
/** Mock-mode state for delete / restore (txn id -> deleted at ms) and learned merchant rules. */
const deletedTxns = new Map<string, number>();
const rules = new Map<string, { id: string; pattern: string; categoryId: string }>();
const F = `*/v1/families/:familyId`;

/** One handler per route a screen uses; all answer from the deterministic demo family. */
export const handlers: HttpHandler[] = [
  http.get("*/v1/me", () =>
    HttpResponse.json({
      user: {
        id: demo.me.id,
        phone: demo.me.phone,
        name: demo.me.name,
        locale: "bn",
        numeralStyle: "bn",
        simpleMode: false,
      },
      families: [demo.family],
    }),
  ),
  http.get("*/v1/policy", ({ request }) => {
    const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "bn";
    return HttpResponse.json({ version: "2026-01", text: locale === "en" ? "Privacy policy" : "গোপনীয়তা নীতি" });
  }),
  http.post("*/v1/me/consents", () => new HttpResponse(null, { status: 204 })),
  http.get("*/v1/invites/:token", () =>
    HttpResponse.json({
      familyName: demo.family.name,
      memberCount: demo.members.length,
      inviter: { id: demo.me.id, name: demo.me.name },
      role: "member",
      expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    }),
  ),
  http.post("*/v1/invites/:token/accept", () => HttpResponse.json({ familyId: demo.family.id })),
  http.get("*/v1/families", () => HttpResponse.json([demo.family])),
  http.post("*/v1/families", () => HttpResponse.json(demo.family, { status: 201 })),
  http.get(`${F}/categories`, () => HttpResponse.json(demo.categories)),
  http.get(`${F}/accounts`, () => HttpResponse.json(demo.accounts)),
  http.get(`${F}/members`, () => HttpResponse.json(demo.members)),
  http.get(`${F}/budgets`, () => HttpResponse.json({ budgets: demo.budgets })),
  http.get(`${F}/festival-budgets`, () => HttpResponse.json([])),
  http.get(`${F}/transactions`, () => HttpResponse.json({ items: demo.transactions.slice(0, 50), nextCursor: null })),
  http.get(`${F}/transactions/:txnId`, ({ params }) => {
    const id = String(params.txnId);
    const x = demo.transactions.find((r) => r.id === id);
    if (!x) return HttpResponse.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
    if (deletedTxns.has(id)) {
      const restorableUntil = new Date(deletedTxns.get(id)! + 30 * 86_400_000).toISOString();
      return HttpResponse.json(
        { error: { code: "transaction_deleted", message: "Deleted", details: { restorableUntil } } },
        { status: 410 },
      );
    }
    const cat = demo.categories.find((c) => c.id === x.categoryId);
    const acct = demo.accounts.find((a) => a.id === x.accountId);
    const who = demo.members.find((m) => m.userId === x.paidByUserId);
    return HttpResponse.json({
      id,
      type: x.kind,
      amountPaisa: x.amountPaisa,
      feePaisa: 0,
      occurredAt: x.occurredAt,
      dayKey: x.occurredAt.slice(0, 10),
      categoryId: x.categoryId,
      categoryNameBn: cat?.nameBn ?? null,
      categoryNameEn: cat?.nameEn ?? null,
      accountId: x.accountId,
      accountName: acct?.name ?? null,
      paidByUserId: x.paidByUserId,
      paidByName: who?.name ?? null,
      createdBy: x.paidByUserId,
      note: x.note,
      counterparty: null,
      source: "manual",
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
      createdAt: x.occurredAt,
      updatedAt: x.occurredAt,
    });
  }),
  http.delete(`${F}/transactions/:txnId`, ({ params }) => {
    deletedTxns.set(String(params.txnId), Date.now());
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${F}/transactions/:txnId/restore`, ({ params }) => {
    deletedTxns.delete(String(params.txnId));
    return HttpResponse.json({ id: params.txnId });
  }),
  http.get(`${F}/merchant-rules`, () => HttpResponse.json([...rules.values()])),
  http.post(`${F}/merchant-rules`, async ({ request }) => {
    const body = (await request.json()) as { pattern: string; categoryId: string };
    const rule = { id: crypto.randomUUID(), ...body };
    rules.set(rule.id, rule);
    return HttpResponse.json(rule, { status: 201 });
  }),
  http.delete(`${F}/merchant-rules/:ruleId`, ({ params }) => {
    rules.delete(String(params.ruleId));
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${F}/reports/summary`, ({ request }) => {
    const month = new URL(request.url).searchParams.get("month") ?? "2026-01";
    const expense = demo.transactions.filter((t) => t.kind === "expense");
    const total = (xs: typeof expense) => xs.reduce((s, t) => s + t.amountPaisa, 0);
    return HttpResponse.json({
      month,
      incomePaisa: total(demo.transactions.filter((t) => t.kind === "income")),
      expensePaisa: total(expense),
      previous: { month: "2025-12", incomePaisa: 0, expensePaisa: 0 },
      byCategory: demo.categories.map((c) => ({
        categoryId: c.id,
        name: c.nameBn,
        totalPaisa: total(expense.filter((t) => t.categoryId === c.id)),
      })),
      byMember: [],
      byAccount: [],
    });
  }),
  http.get(`${F}/presence`, () =>
    HttpResponse.json(demo.members.map((m, i) => ({ userId: m.userId, online: i % 2 === 0, lastSeenAt: null }))),
  ),
  http.get(`${F}/activity`, () => HttpResponse.json([])),
  http.get(`${F}/ai/summary`, ({ request }) => {
    const month = new URL(request.url).searchParams.get("month") ?? "2026-01";
    return HttpResponse.json({
      month,
      locale: "bn",
      text: "এই মাসের খরচ ঠিক আছে।",
      speechText: "এই মাসের খরচ ঠিক আছে।",
      usedAi: false,
    });
  }),
  http.post(`${F}/ai/ask`, () => HttpResponse.json({ answer: "এ মাসে বাজারে খরচ হয়েছে ৳ ১৬,৮০০।", usedAi: true })),
  // Mock-mode sign-in: code 123456 works, anything else is a wrong code (5 tries).
  http.post("*/api/auth/otp/request", () => HttpResponse.json({ sent: true, devCode: "123456" })),
  http.post("*/api/auth/otp/verify", async ({ request }) => {
    const { code } = (await request.json()) as { code?: string };
    if (code === "123456") return HttpResponse.json({ ok: true, user: demo.me, families: [demo.family] });
    return HttpResponse.json(
      { error: { code: "otp_invalid", message: "Invalid code", details: { attemptsLeft: 4 } } },
      { status: 401 },
    );
  }),
];

/**
 * Test helper: answer the next matching request with `response`, then fall back to the defaults.
 * `path` is the proxied route, e.g. `/v1/me`.
 */
export function overrideOnce(
  path: string,
  response: Response | object,
  method: "get" | "post" | "put" | "patch" | "delete" = "get",
) {
  if (!target) throw new Error("mock server is not bound; import @/mocks/server first");
  target.use(
    http[method](`*/api/proxy${path}`, () => (response instanceof Response ? response : HttpResponse.json(response)), {
      once: true,
    }),
  );
}
