import { http, HttpResponse, type HttpHandler } from "msw";
import { demoFamily } from "./fixtures";

// server.ts binds itself here (avoids a circular import between handlers and server).
let target: { use: (...h: HttpHandler[]) => void } | null = null;
export function bindServer(s: { use: (...h: HttpHandler[]) => void }) {
  target = s;
}

const demo = demoFamily();
const F = `*/api/proxy/v1/families/:familyId`;

/** One handler per route a screen uses; all answer from the deterministic demo family. */
export const handlers: HttpHandler[] = [
  http.get("*/api/proxy/v1/me", () =>
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
  http.get("*/api/proxy/v1/invites/:token", () =>
    HttpResponse.json({
      familyName: demo.family.name,
      memberCount: demo.members.length,
      inviter: { id: demo.me.id, name: demo.me.name },
      role: "member",
      expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    }),
  ),
  http.post("*/api/proxy/v1/invites/:token/accept", () => HttpResponse.json({ familyId: demo.family.id })),
  http.get("*/api/proxy/v1/families", () => HttpResponse.json([demo.family])),
  http.post("*/api/proxy/v1/families", () => HttpResponse.json(demo.family, { status: 201 })),
  http.get(`${F}/categories`, () => HttpResponse.json(demo.categories)),
  http.get(`${F}/accounts`, () => HttpResponse.json(demo.accounts)),
  http.get(`${F}/members`, () => HttpResponse.json(demo.members)),
  http.get(`${F}/budgets`, () => HttpResponse.json({ budgets: demo.budgets })),
  http.get(`${F}/transactions`, () => HttpResponse.json({ items: demo.transactions.slice(0, 50), nextCursor: null })),
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
