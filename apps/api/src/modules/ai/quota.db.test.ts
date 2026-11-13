import Fastify, { type LightMyRequestResponse } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { describe, expect, it } from "vitest";
import { withTestDb } from "../../../tests/support/db-test.js";
import { registerErrorHandler } from "../../platform/errors.js";
import type { ModuleContext } from "../../platform/module.js";
import { createAiModule, type AiClient } from "./index.js";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-01-15T06:00:00.000Z");

/** Answers every parse call with one fixed draft, so a request counts as an AI use. */
const fakeClient = {
  beta: {
    messages: {
      parse: async () => ({
        parsed_output: {
          drafts: [
            {
              type: "expense",
              amountTaka: 120,
              feeTaka: 0,
              date: "2026-01-15",
              categoryKey: null,
              accountType: null,
              note: "rickshaw",
              counterparty: null,
              confidence: 0.9,
            },
          ],
        },
        stop_reason: "end_turn",
        content: [],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    },
  },
} as unknown as AiClient;

interface Harness {
  app: ReturnType<typeof Fastify>;
  clock: { now: Date };
  calls: { count: number };
  parse(text?: string): Promise<LightMyRequestResponse>;
}

async function harness(
  db: ModuleContext["db"],
  opts: { quota: number; flagsOn?: boolean; billingFeatures?: Record<string, boolean>; fail?: boolean },
): Promise<Harness> {
  const calls = { count: 0 };
  const client = {
    beta: {
      messages: {
        parse: async () => {
          calls.count++;
          if (opts.fail) return { parsed_output: null, stop_reason: "end_turn", content: [], usage: {} };
          return (
            fakeClient as unknown as { beta: { messages: { parse: () => Promise<unknown> } } }
          ).beta.messages.parse();
        },
      },
    },
  } as unknown as AiClient;
  const clock = { now: NOW };
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  app.decorate("authenticate", async (req: { user?: unknown }) => {
    req.user = { sub: "u1" };
  });
  const ctx = {
    db,
    config: undefined,
    clock: () => clock.now,
    flags: { isOn: async (n: string) => n === "billing" && !!opts.flagsOn },
    facades: {
      families: {
        requireRole: async () => ({ role: "owner", family: { id: "f", name: "f", role: "owner" } }),
        getAiQuota: async () => ({ quotaMonth: opts.quota, plan: "free" }),
      },
      billing: { entitlements: async () => ({ features: opts.billingFeatures ?? {} }) },
      ledger: { listCategories: async () => [], getMonthTotals: async () => ({}), askQueries: () => ({}) },
    },
  } as unknown as ModuleContext;
  await createAiModule({ client }).register(app, ctx);
  return {
    app,
    clock,
    calls,
    parse: (text = "rickshaw er bhara kintu keu jane na") =>
      app.inject({
        method: "POST",
        url: `/v1/families/${FAMILY}/ai/parse`,
        payload: { text, now: clock.now.toISOString() },
      }),
  };
}

const usedRows = (sql: (s: TemplateStringsArray, ...v: unknown[]) => Promise<{ requests: number }[]>) =>
  sql`select requests from ai.ai_usage where family_id = ${FAMILY}`;

describe("ai quota (db)", () => {
  it("parse over quota returns amount-only draft and quotaExhausted true", async () => {
    await withTestDb(async ({ db }) => {
      const h = await harness(db, { quota: 0 });
      const res = await h.parse("kichu ekta 120");
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ usedAi: false, quotaExhausted: true });
      expect(res.json().drafts).toHaveLength(1);
      expect(res.json().drafts[0].amountPaisa).toBe(12000);
      expect(h.calls.count).toBe(0);
      await h.app.close();
    });
  });

  it("ask over quota returns 429 with used limit resetsOn", async () => {
    await withTestDb(async ({ db }) => {
      const h = await harness(db, { quota: 1 });
      expect((await h.parse()).statusCode).toBe(200);
      const res = await h.app.inject({
        method: "POST",
        url: `/v1/families/${FAMILY}/ai/ask`,
        payload: { question: "How much did we spend?" },
      });
      expect(res.statusCode).toBe(429);
      expect(res.json().error).toMatchObject({
        code: "ai_quota",
        details: { used: 1, limit: 1, resetsOn: "2026-02-01" },
      });
      await h.app.close();
    });
  });

  it("ten parallel parses with one remaining use only one AI call", async () => {
    await withTestDb(async ({ db, sql }) => {
      const h = await harness(db, { quota: 3 });
      await h.parse();
      await h.parse();
      h.calls.count = 0;
      const results = await Promise.all(Array.from({ length: 10 }, () => h.parse()));
      expect(results.filter((r) => r.json<{ usedAi: boolean }>().usedAi)).toHaveLength(1);
      expect(results.filter((r) => r.json<{ quotaExhausted?: boolean }>().quotaExhausted)).toHaveLength(9);
      expect(h.calls.count).toBe(1);
      expect((await usedRows(sql as never)).reduce((a, r) => a + r.requests, 0)).toBe(3);
      await h.app.close();
    });
  });

  it("failed AI call releases the reservation", async () => {
    await withTestDb(async ({ db, sql }) => {
      const h = await harness(db, { quota: 2, fail: true });
      const res = await h.parse();
      expect(res.statusCode).toBe(503);
      expect(h.calls.count).toBe(1);
      expect((await usedRows(sql as never)).reduce((a, r) => a + r.requests, 0)).toBe(0);
      await h.app.close();
    });
  });

  it("receipt blocked with plan_feature when billing_enforced and plan lacks it", async () => {
    await withTestDb(async ({ db }) => {
      const h = await harness(db, { quota: 5, flagsOn: true, billingFeatures: { receiptVision: false, ask: true } });
      const res = await h.app.inject({
        method: "POST",
        url: `/v1/families/${FAMILY}/ai/receipt`,
        payload: { imageBase64: "A".repeat(200), mediaType: "image/png" },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatchObject({ code: "plan_feature", details: { feature: "receipt" } });
      expect(h.calls.count).toBe(0);
      await h.app.close();
    });
  });

  it("quota resets in a new Dhaka month", async () => {
    await withTestDb(async ({ db }) => {
      const h = await harness(db, { quota: 1 });
      expect((await h.parse()).json().usedAi).toBe(true);
      expect((await h.parse()).json().quotaExhausted).toBe(true);
      // 2026-01-31 18:30 UTC is already 2026-02-01 in Dhaka.
      h.clock.now = new Date("2026-01-31T18:30:00.000Z");
      expect((await h.parse()).json().usedAi).toBe(true);
      await h.app.close();
    });
  });
});

describe("ai quota usage (db)", () => {
  it("usage row increments once per call", async () => {
    await withTestDb(async ({ db, sql }) => {
      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      registerErrorHandler(app);
      app.decorate("authenticate", async (req: { user?: unknown }) => {
        req.user = { sub: "u1" };
      });
      const ctx = {
        db,
        config: undefined,
        clock: () => NOW,
        facades: {
          families: {
            requireRole: async () => ({ role: "owner", family: { id: "f", name: "f", role: "owner" } }),
            getAiQuota: async () => ({ quotaMonth: 2, plan: "free" }),
          },
          ledger: { listCategories: async () => [], getMonthTotals: async () => ({}), askQueries: () => ({}) },
        },
      } as unknown as ModuleContext;
      const facade = await createAiModule({ client: fakeClient }).register(app, ctx);

      const call = () =>
        app.inject({
          method: "POST",
          url: `/v1/families/${FAMILY}/ai/parse`,
          payload: { text: "rickshaw er bhara kintu keu jane na", now: NOW.toISOString() },
        });
      const count = async () =>
        (await sql<{ requests: number }[]>`select requests from ai.ai_usage where family_id = ${FAMILY}`)[0]
          ?.requests ?? 0;

      expect((await call()).statusCode).toBe(200);
      expect(await count()).toBe(1);
      expect((await call()).statusCode).toBe(200);
      expect(await count()).toBe(2);
      // Quota (2) is used up: the model is no longer asked and nothing is counted.
      expect((await call()).json().usedAi).toBe(false);
      expect(await count()).toBe(2);
      expect(await facade.getUsage(FAMILY, "2026-01")).toEqual({ month: "2026-01", requests: 2, quota: 2 });
      await app.close();
    });
  });
});
