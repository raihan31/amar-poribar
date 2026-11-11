import type { AiClient } from "./claude-client.js";

/**
 * An Anthropic-shaped stand-in for tests: `beta.messages.parse` returns canned structured output chosen by the
 * fingerprint of the last user message (first matching substring). No match throws, so a test fails loudly when the
 * model is reached unexpectedly. Tests never need credentials (SRS 1.5 rule 4).
 */
export interface FakeClaude {
  readonly client: AiClient;
  /** Number of requests that reached the "model". */
  readonly calls: { count: number };
}

export function createFakeClaude(canned: { fingerprint: string; output: unknown }[] = []): FakeClaude {
  const calls = { count: 0 };
  const parse = async (req: { messages?: { role: string; content: unknown }[] }) => {
    calls.count++;
    const last = [...(req.messages ?? [])].reverse().find((m) => m.role === "user");
    const text = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");
    const hit = canned.find((c) => text.includes(c.fingerprint));
    if (!hit) throw new Error(`fake claude: no canned response for "${text.slice(0, 60)}"`);
    return {
      parsed_output: hit.output,
      stop_reason: "end_turn",
      content: [],
      usage: { input_tokens: 1, output_tokens: 1 },
    };
  };
  const client = { beta: { messages: { parse } }, messages: { create: parse } } as unknown as AiClient;
  return { client, calls };
}
