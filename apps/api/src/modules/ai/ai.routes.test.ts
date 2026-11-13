import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { afterEach, describe, expect, it } from "vitest";
import { registerErrorHandler } from "../../platform/errors.js";
import type { ModuleContext } from "../../platform/module.js";
import type { AiStore, SummaryKey, CachedSummary } from "./app/deps.js";
import { createAiModule, type AiClient } from "./index.js";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-01-15T06:00:00.000Z");

class MemoryStore implements AiStore {
  used = new Map<string, number>();
  summaries = new Map<string, CachedSummary>();
  requestsUsed = async (familyId: string, month: string) => this.used.get(`${familyId}:${month}`) ?? 0;
  recordUse = async (familyId: string, month: string) => {
    this.used.set(`${familyId}:${month}`, (await this.requestsUsed(familyId, month)) + 1);
  };
  findSummary = async (k: SummaryKey) => this.summaries.get(JSON.stringify(k)) ?? null;
  saveSummary = async (k: SummaryKey, v: CachedSummary) => void this.summaries.set(JSON.stringify(k), v);
}

/** A stand-in for the model that fails the test if anything reaches it. */
function forbiddenClient(calls: string[]): AiClient {
  const fail = (name: string) => () => {
    calls.push(name);
    throw new Error(`model must not be called: ${name}`);
  };
  return {
    messages: { create: fail("messages.create") },
    beta: { messages: { parse: fail("beta.messages.parse") } },
  } as unknown as AiClient;
}

const totals = (expensePaisa: number) => ({
  incomePaisa: 0,
  expensePaisa,
  byCategory: [{ categoryId: "c1", name: "বাজার", nameEn: "Groceries", totalPaisa: expensePaisa }],
  byMember: [],
  byAccount: [],
});

async function build(opts: { client?: AiClient; quota?: number; store?: MemoryStore }) {
  const store = opts.store ?? new MemoryStore();
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  app.decorate("authenticate", async (req: { user?: unknown }) => {
    req.user = { sub: "u1" };
  });
  const ctx = {
    db: {},
    config: undefined,
    clock: () => NOW,
    facades: {
      families: {
        requireRole: async () => "owner",
        getAiQuota: async () => ({ quotaMonth: opts.quota ?? 50, plan: "free" }),
      },
      ledger: {
        listCategories: async () => [],
        monthTotals: async () => totals(250_000),
        askQueries: () => ({}),
      },
    },
  } as unknown as ModuleContext;
  await createAiModule({ store, client: opts.client, model: undefined }).register(app, ctx);
  return { app, store };
}

let open: { close(): Promise<void> } | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

describe("ai routes (fake model)", () => {
  it("parse uses sms parser without calling the model", async () => {
    const calls: string[] = [];
    const t = await build({ client: forbiddenClient(calls) });
    open = t.app;
    const res = await t.app.inject({
      method: "POST",
      url: `/v1/families/${FAMILY}/ai/parse`,
      payload: {
        text: "You have received Tk 5,000.00 from 01712345678. Fee Tk 0.00. Balance Tk 7,500.00. TrxID 9A1B2C3D4E at 14/01/2026 10:30",
        now: NOW.toISOString(),
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().usedAi).toBe(false);
    expect(res.json().drafts).toHaveLength(1);
    expect(calls).toEqual([]);
    expect(t.store.used.size).toBe(0);
  });

  it("quota exhausted returns 429 ai_quota", async () => {
    const calls: string[] = [];
    const store = new MemoryStore();
    await store.recordUse(FAMILY, "2026-01");
    const t = await build({ client: forbiddenClient(calls), quota: 1, store });
    open = t.app;
    const res = await t.app.inject({
      method: "POST",
      url: `/v1/families/${FAMILY}/ai/ask`,
      payload: { question: "How much did we spend on groceries?" },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe("ai_quota");
    expect(calls).toEqual([]);
  });

  it("summary falls back to template without a key", async () => {
    const t = await build({ client: undefined });
    open = t.app;
    const res = await t.app.inject({
      method: "GET",
      url: `/v1/families/${FAMILY}/ai/summary?month=2026-01&locale=en`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().usedAi).toBe(false);
    expect(res.json().text).toContain("Groceries");
    expect(t.store.used.size).toBe(0);
    expect(t.store.summaries.size).toBe(0);
  });

  it("ask and receipt answer 503 ai_unavailable without a key", async () => {
    const t = await build({ client: undefined });
    open = t.app;
    const ask = await t.app.inject({
      method: "POST",
      url: `/v1/families/${FAMILY}/ai/ask`,
      payload: { question: "hello there" },
    });
    expect(ask.statusCode).toBe(503);
    expect(ask.json().error.code).toBe("ai_unavailable");
  });

  it("facade reports usage against the quota", async () => {
    const store = new MemoryStore();
    await store.recordUse(FAMILY, "2026-01");
    const t = await build({ client: undefined, quota: 5, store });
    open = t.app;
    const ctx = {
      db: {},
      config: undefined,
      clock: () => NOW,
      facades: {
        families: { requireRole: async () => "owner", getAiQuota: async () => ({ quotaMonth: 5, plan: "free" }) },
        ledger: {},
      },
    } as unknown as ModuleContext;
    const facade = await createAiModule({ store }).register(Fastify(), ctx);
    expect(await facade.getUsage(FAMILY, "2026-01")).toEqual({ month: "2026-01", requests: 1, quota: 5 });
  });
});
