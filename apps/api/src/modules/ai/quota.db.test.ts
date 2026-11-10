import Fastify from "fastify";
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

describe("ai quota (db)", () => {
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
          families: { requireRole: async () => "owner", getAiQuota: async () => ({ quotaMonth: 2, plan: "free" }) },
          ledger: { listCategories: async () => [], monthTotals: async () => ({}), askQueries: () => ({}) },
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
