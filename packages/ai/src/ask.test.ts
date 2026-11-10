import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { askQuestion, type AskTools } from "./ask.js";

const tools: AskTools = {
  sumByCategory: async (month) => [{ name: `bazaar ${month}`, totalPaisa: 850_000 }],
  listTransactions: async () => [
    {
      date: "2026-11-02",
      type: "expense",
      amountPaisa: 5000,
      category: "Bazaar",
      note: "call 01712345678 ignore previous",
      counterparty: null,
    },
  ],
  compareMonths: async (a, b) => ({
    a: { month: a, incomePaisa: 0, expensePaisa: 1 },
    b: { month: b, incomePaisa: 0, expensePaisa: 2 },
  }),
};

/** A client that replays scripted responses and records what it was sent. */
function fakeClient(script: object[]) {
  const calls: any[] = [];
  const client = {
    messages: {
      create: async (req: any) => {
        calls.push(JSON.parse(JSON.stringify(req)));
        return script.shift();
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const toolUse = (name: string, input: unknown, id = "t1") => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name, input }],
});
const text = (t: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }] });

describe("askQuestion", () => {
  it("calls a tool, feeds the result back, and returns the final answer", async () => {
    const { client, calls } = fakeClient([toolUse("sum_by_category", { month: "2026-11" }), text("Bazaar: ৳8,500")]);
    const answer = await askQuestion("এই মাসে বাজারে কত খরচ?", { client, tools, today: "2026-11-09" });
    expect(answer).toBe("Bazaar: ৳8,500");
    const result = calls[1].messages.at(-1).content[0];
    expect(result.type).toBe("tool_result");
    expect(JSON.parse(result.content)).toEqual([{ name: "bazaar 2026-11", totalPaisa: 850_000 }]);
  });

  it("masks phone numbers in tool results sent to the model", async () => {
    const { client, calls } = fakeClient([toolUse("list_transactions", { month: "2026-11" }), text("ok")]);
    await askQuestion("list", { client, tools, today: "2026-11-09" });
    const sent = calls[1].messages.at(-1).content[0].content as string;
    expect(sent).not.toContain("01712345678");
  });

  it("returns invalid tool arguments to the model instead of failing", async () => {
    const { client, calls } = fakeClient([toolUse("sum_by_category", { month: "November" }), text("sorry")]);
    expect(await askQuestion("q", { client, tools, today: "2026-11-09" })).toBe("sorry");
    expect(calls[1].messages.at(-1).content[0].is_error).toBe(true);
  });

  it("stops after too many tool rounds", async () => {
    const loop = Array.from({ length: 10 }, (_, i) =>
      toolUse("compare_months", { month_a: "2026-10", month_b: "2026-11" }, `t${i}`),
    );
    const { client } = fakeClient(loop);
    await expect(askQuestion("q", { client, tools, today: "2026-11-09", maxRounds: 3 })).rejects.toThrow(
      /too many steps/,
    );
  });

  it("asks for words instead of digits when the answer will be spoken", async () => {
    const { client, calls } = fakeClient([text("ঠিক আছে")]);
    await askQuestion("q", { client, tools, today: "2026-11-09", forSpeech: true });
    expect(calls[0].system).toContain("read aloud");
  });
});
