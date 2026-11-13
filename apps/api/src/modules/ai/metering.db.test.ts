import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { createFakeClaude } from "./infra/fake-claude.js";

const DRAFT = {
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
};
// The quick parser cannot place this, so it goes to the model.
const TEXT = "rickshaw er bhara kintu keu jane na";

async function createFamily(t: TestApp, tokens: Tokens): Promise<string> {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(tokens),
    payload: { name: "রহিম পরিবার" },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

type UsageRow = {
  feature: string;
  requests: number;
  input_tokens: string;
  output_tokens: string;
  latency_ms_sum: string;
  errors: number;
};

describe("ai usage metering (db)", () => {
  it("parse records feature parse with tokens", async () => {
    await withTestDb(async ({ db, sql }) => {
      const fake = createFakeClaude([{ fingerprint: "rickshaw", output: DRAFT }]);
      const t = await buildTestApp({ db, sql, anthropic: fake.client });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const res = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/ai/parse`,
        headers: t.as(owner),
        payload: { text: TEXT },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().usedAi).toBe(true);
      const rows = await sql<UsageRow[]>`select * from ai.ai_usage where family_id = ${familyId}`;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ feature: "parse", requests: 1, errors: 0 });
      expect(Number(rows[0]!.input_tokens)).toBe(1);
      expect(Number(rows[0]!.output_tokens)).toBe(1);
      expect(Number(rows[0]!.latency_ms_sum)).toBeGreaterThanOrEqual(0);
      await t.close();
    });
  });

  it("unavailable response increments errors not requests", async () => {
    await withTestDb(async ({ db, sql }) => {
      // The model answers without structured output, which the receipt reader treats as unavailable.
      const fake = createFakeClaude([{ fingerprint: "Read this receipt", output: null }]);
      const t = await buildTestApp({ db, sql, anthropic: fake.client });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const res = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/ai/receipt`,
        headers: t.as(owner),
        payload: { imageBase64: "A".repeat(200), mediaType: "image/png" },
      });
      expect(res.statusCode).toBe(503);
      const rows = await sql<UsageRow[]>`select * from ai.ai_usage where family_id = ${familyId}`;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ feature: "receipt", requests: 0, errors: 1 });
      await t.close();
    });
  });

  it("summary template path records nothing", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const res = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/ai/summary?month=2026-01&locale=en`,
        headers: t.as(owner),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().usedAi).toBe(false);
      const rows = await sql`select * from ai.ai_usage where family_id = ${familyId}`;
      expect(rows).toHaveLength(0);
      await t.close();
    });
  });

  it("two features in one month keep separate rows", async () => {
    await withTestDb(async ({ db, sql }) => {
      const fake = createFakeClaude([
        { fingerprint: "rickshaw", output: DRAFT },
        { fingerprint: "Read this receipt", output: DRAFT },
      ]);
      const t = await buildTestApp({ db, sql, anthropic: fake.client });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const parse = () =>
        t.app.inject({
          method: "POST",
          url: `/v1/families/${familyId}/ai/parse`,
          headers: t.as(owner),
          payload: { text: TEXT },
        });
      expect((await parse()).statusCode).toBe(200);
      expect((await parse()).statusCode).toBe(200);
      const receipt = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/ai/receipt`,
        headers: t.as(owner),
        payload: { imageBase64: "A".repeat(200), mediaType: "image/png" },
      });
      expect(receipt.statusCode).toBe(200);
      const rows = await sql<UsageRow[]>`
        select feature, requests from ai.ai_usage where family_id = ${familyId} order by feature`;
      expect(rows.map((r) => [r.feature, r.requests])).toEqual([
        ["parse", 2],
        ["receipt", 1],
      ]);
      await t.close();
    });
  });

  it("no text columns exist in ai_usage", async () => {
    await withTestDb(async ({ sql }) => {
      const cols = await sql<{ column_name: string; data_type: string }[]>`
        select column_name, data_type from information_schema.columns
        where table_schema = 'ai' and table_name = 'ai_usage'`;
      const textCols = cols.filter((c) => c.data_type === "text").map((c) => c.column_name);
      // `month` (YYYY-MM) and `feature` (fixed vocabulary) are the only text columns; no free text is stored.
      expect(textCols.sort()).toEqual(["feature", "month"]);
    });
  });
});
