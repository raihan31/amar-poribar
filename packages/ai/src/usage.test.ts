import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { askQuestion, monthlySummary, parseReceipt, parseWithLlm, type AiUsage, type AskTools } from "./index.js";

const usage = { input_tokens: 120, output_tokens: 30 };
const draftOutput = {
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

function parseClient(output: unknown): Anthropic {
  return {
    beta: {
      messages: {
        parse: async () => {
          await new Promise((r) => setTimeout(r, 5));
          return { parsed_output: output, stop_reason: "end_turn", content: [], usage };
        },
      },
    },
  } as unknown as Anthropic;
}

describe("onUsage", () => {
  it("onUsage is called with tokens and latency", async () => {
    const seen: AiUsage[] = [];
    await parseWithLlm("rickshaw 120", {
      client: parseClient(draftOutput),
      categories: [],
      onUsage: (u) => seen.push(u),
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].inputTokens).toBe(120);
    expect(seen[0].outputTokens).toBe(30);
    expect(seen[0].latencyMs).toBeGreaterThanOrEqual(0);

    const receipt: AiUsage[] = [];
    await parseReceipt(
      { base64: "AAAA", mediaType: "image/png" },
      { client: parseClient(draftOutput), categories: [], onUsage: (u) => receipt.push(u) },
    );
    expect(receipt).toHaveLength(1);

    const summary: AiUsage[] = [];
    await monthlySummary(
      { month: "2026-01", locale: "en", expensePaisa: 100, incomePaisa: 0, lastMonthExpensePaisa: 0, categories: [] },
      { client: parseClient({ summary: "Spent {TOTAL}." }), onUsage: (u) => summary.push(u) },
    );
    expect(summary).toHaveLength(1);
    expect(summary[0].inputTokens).toBe(120);
  });

  it("Ask reports one entry per round trip", async () => {
    const script: object[] = [
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "sum_by_category", input: { month: "2026-01" } }],
        usage,
      },
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "ok" }],
        usage: { input_tokens: 200, output_tokens: 10 },
      },
    ];
    const client = { messages: { create: async () => script.shift() } } as unknown as Anthropic;
    const tools = {
      sumByCategory: async () => [],
      listTransactions: async () => [],
      compareMonths: async () => ({}),
    } as unknown as AskTools;
    const seen: AiUsage[] = [];
    await askQuestion("q", { client, tools, today: "2026-01-15", onUsage: (u) => seen.push(u) });
    expect(seen.map((u) => u.inputTokens)).toEqual([120, 200]);
    expect(seen.map((u) => u.outputTokens)).toEqual([30, 10]);
  });
});
