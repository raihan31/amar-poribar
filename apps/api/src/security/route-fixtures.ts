/**
 * Per-route request builders for the tenant-isolation test (SRS 11.2).
 *
 * Every operation of `openapi.json` that has a family-scoped path parameter needs an entry in
 * `ROUTE_FIXTURES`, keyed `"METHOD /path"` exactly as in the OpenAPI document. The builder receives the
 * ids of the resources that family A owns and returns the request an outsider (family B) will send.
 * A route without an entry fails the test until one is added.
 */

/** Ids of the resources created for family A (one per route group). */
export interface TenantCtx {
  familyId: string;
  /** The family owner's user id (target of the member routes). */
  userId: string;
  accountId: string;
  categoryId: string;
  festivalId: string;
  recurringId: string;
  txnId: string;
}

export interface RouteRequest {
  params: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

export type RouteFixture = (ctx: TenantCtx) => RouteRequest;

/** Minimal HTTP caller so seeding does not depend on the app's internals. */
export type Call = (
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  opts?: { token?: string; body?: unknown },
) => Promise<{ status: number; body: unknown; headers: Record<string, string | string[] | number | undefined> }>;

const fam = (c: TenantCtx) => ({ familyId: c.familyId });
const MONTH = "2026-01";
const TAKA_100 = 10_000; // integer paisa

export const ROUTE_FIXTURES: Record<string, RouteFixture> = {
  "GET /v1/families/{familyId}/accounts": (c) => ({ params: fam(c) }),
  "POST /v1/families/{familyId}/accounts": (c) => ({ params: fam(c), body: { name: "Isolation", type: "cash" } }),
  "PATCH /v1/families/{familyId}/accounts/{accountId}": (c) => ({
    params: { ...fam(c), accountId: c.accountId },
    body: { name: "Hijacked" },
  }),
  "POST /v1/families/{familyId}/ai/ask": (c) => ({ params: fam(c), body: { question: "How much did we spend?" } }),
  "POST /v1/families/{familyId}/ai/parse": (c) => ({ params: fam(c), body: { text: "bazaar 500" } }),
  "POST /v1/families/{familyId}/ai/receipt": (c) => ({
    params: fam(c),
    body: { mediaType: "image/png", imageBase64: "A".repeat(200) },
  }),
  "GET /v1/families/{familyId}/ai/summary": (c) => ({ params: fam(c), query: { month: MONTH } }),
  "GET /v1/families/{familyId}/budgets": (c) => ({ params: fam(c), query: { month: MONTH } }),
  "PUT /v1/families/{familyId}/budgets": (c) => ({
    params: fam(c),
    query: { month: MONTH },
    body: { budgets: [{ categoryId: c.categoryId, limitPaisa: TAKA_100 }] },
  }),
  "GET /v1/families/{familyId}/categories": (c) => ({ params: fam(c) }),
  "POST /v1/families/{familyId}/categories": (c) => ({
    params: fam(c),
    body: { kind: "expense", nameEn: "Isolation", nameBn: "আইসোলেশন" },
  }),
  "PATCH /v1/families/{familyId}/categories/{categoryId}": (c) => ({
    params: { ...fam(c), categoryId: c.categoryId },
    body: { nameEn: "Hijacked" },
  }),
  "GET /v1/families/{familyId}/festival-budgets": (c) => ({ params: fam(c) }),
  "POST /v1/families/{familyId}/festival-budgets": (c) => ({
    params: fam(c),
    body: { name: "Eid", startsOn: "2026-03-01", endsOn: "2026-03-10", limitPaisa: TAKA_100 },
  }),
  "DELETE /v1/families/{familyId}/festival-budgets/{festivalId}": (c) => ({
    params: { ...fam(c), festivalId: c.festivalId },
  }),
  "PATCH /v1/families/{familyId}/festival-budgets/{festivalId}": (c) => ({
    params: { ...fam(c), festivalId: c.festivalId },
    body: { name: "Hijacked" },
  }),
  "POST /v1/families/{familyId}/invites": (c) => ({ params: fam(c), body: { role: "member" } }),
  "GET /v1/families/{familyId}/invites": (c) => ({ params: fam(c) }),
  "DELETE /v1/families/{familyId}/invites/{inviteId}": (c) => ({
    params: { ...fam(c), inviteId: "00000000-0000-4000-8000-000000000000" },
  }),
  "GET /v1/families/{familyId}/members": (c) => ({ params: fam(c) }),
  "DELETE /v1/families/{familyId}/members/{userId}": (c) => ({ params: { ...fam(c), userId: c.userId } }),
  "PATCH /v1/families/{familyId}/members/{userId}": (c) => ({
    params: { ...fam(c), userId: c.userId },
    body: { role: "viewer" },
  }),
  "GET /v1/families/{familyId}/recurring": (c) => ({ params: fam(c) }),
  "POST /v1/families/{familyId}/recurring": (c) => ({
    params: fam(c),
    body: { name: "Rent", amountPaisa: TAKA_100, dayOfMonth: 5, startsOn: "2026-01-05" },
  }),
  "GET /v1/families/{familyId}/recurring/drafts": (c) => ({ params: fam(c), query: { month: MONTH } }),
  "GET /v1/families/{familyId}/recurring/reminders": (c) => ({ params: fam(c) }),
  "PATCH /v1/families/{familyId}/recurring/{recurringId}": (c) => ({
    params: { ...fam(c), recurringId: c.recurringId },
    body: { name: "Hijacked" },
  }),
  "POST /v1/families/{familyId}/recurring/{recurringId}/confirm": (c) => ({
    params: { ...fam(c), recurringId: c.recurringId },
    query: { month: MONTH },
    body: {},
  }),
  "GET /v1/families/{familyId}/reports/export.csv": (c) => ({ params: fam(c), query: { month: MONTH } }),
  "GET /v1/families/{familyId}/reports/remittances": (c) => ({ params: fam(c) }),
  "GET /v1/families/{familyId}/reports/summary": (c) => ({ params: fam(c), query: { month: MONTH } }),
  "POST /v1/families/{familyId}/sync": (c) => ({
    params: fam(c),
    body: { nodeId: "isolation-node", cursor: null, changes: { transactions: [] } },
  }),
  "GET /v1/families/{familyId}/transactions": (c) => ({ params: fam(c), query: { month: MONTH } }),
  "POST /v1/families/{familyId}/transactions": (c) => ({
    params: fam(c),
    body: {
      type: "expense",
      amountPaisa: TAKA_100,
      occurredAt: "2026-01-10T06:00:00.000Z",
      categoryId: c.categoryId,
      accountId: c.accountId,
    },
  }),
  "DELETE /v1/families/{familyId}/transactions/{txnId}": (c) => ({ params: { ...fam(c), txnId: c.txnId } }),
  "PATCH /v1/families/{familyId}/transactions/{txnId}": (c) => ({
    params: { ...fam(c), txnId: c.txnId },
    body: { note: "Hijacked" },
  }),
};

function must<T>(res: { status: number; body: unknown }, what: string): T {
  if (res.status < 200 || res.status >= 300)
    throw new Error(`${what} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as T;
}

/** Family A: its owner creates one resource per route group. Returns their ids. */
export async function seedFamilyA(call: Call, ownerToken: string): Promise<TenantCtx> {
  const token = ownerToken;
  const me = must<{ user: { id: string } }>(await call("GET", "/v1/me", { token }), "me");
  const family = must<{ id: string }>(
    await call("POST", "/v1/families", { token, body: { name: "Family A" } }),
    "family A",
  );
  const base = `/v1/families/${family.id}`;
  const categories = must<{ id: string; kind: string }[]>(await call("GET", `${base}/categories`, { token }), "cats");
  const accounts = must<{ id: string }[]>(await call("GET", `${base}/accounts`, { token }), "accounts");
  const category = categories.find((c) => c.kind === "expense") ?? categories[0];
  if (!category || !accounts[0]) throw new Error("family A has no category or account");
  const festival = must<{ id: string }>(
    await call("POST", `${base}/festival-budgets`, {
      token,
      body: { name: "Eid A", startsOn: "2026-03-01", endsOn: "2026-03-10", limitPaisa: TAKA_100 },
    }),
    "festival",
  );
  const recurring = must<{ id: string }>(
    await call("POST", `${base}/recurring`, {
      token,
      body: { name: "Rent A", amountPaisa: TAKA_100, dayOfMonth: 5, startsOn: "2026-01-05" },
    }),
    "recurring",
  );
  const txn = must<{ id: string }>(
    await call("POST", `${base}/transactions`, {
      token,
      body: {
        type: "expense",
        amountPaisa: TAKA_100,
        occurredAt: "2026-01-10T06:00:00.000Z",
        categoryId: category.id,
        accountId: accounts[0].id,
      },
    }),
    "transaction",
  );
  return {
    familyId: family.id,
    userId: me.user.id,
    accountId: accounts[0].id,
    categoryId: category.id,
    festivalId: festival.id,
    recurringId: recurring.id,
    txnId: txn.id,
  };
}

/** Family B: an owner creates the family and invites a plain member, who is the outsider in the test. */
export async function seedOutsiderMember(call: Call, ownerToken: string, memberToken: string): Promise<void> {
  const family = must<{ id: string }>(
    await call("POST", "/v1/families", { token: ownerToken, body: { name: "Family B" } }),
    "family B",
  );
  const invite = must<{ token: string }>(
    await call("POST", `/v1/families/${family.id}/invites`, { token: ownerToken, body: { role: "member" } }),
    "invite",
  );
  must(await call("POST", `/v1/invites/${invite.token}/accept`, { token: memberToken, body: {} }), "accept");
}
