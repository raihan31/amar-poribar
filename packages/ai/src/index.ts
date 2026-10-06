import type Anthropic from "@anthropic-ai/sdk";
import type { TransactionDraft } from "@amar-poribar/shared";
import { parseWithLlm, type CategoryOption } from "./llm.js";
import { parseMfsSms } from "./sms.js";

export * from "./sms.js";
export * from "./llm.js";

export interface ParseInputOptions {
  categories: CategoryOption[];
  now?: Date;
  /** When omitted, only the deterministic SMS parser runs. */
  client?: Anthropic;
  model?: string;
}

/**
 * Parse pipeline (SRS §6.1): deterministic MFS SMS parser first, LLM only as fallback.
 */
export async function parseInput(
  text: string,
  opts: ParseInputOptions,
): Promise<{ drafts: TransactionDraft[]; usedAi: boolean }> {
  const sms = parseMfsSms(text, opts.now);
  if (sms) return { drafts: [sms], usedAi: false };
  if (!opts.client) return { drafts: [], usedAi: false };
  const drafts = await parseWithLlm(text, {
    client: opts.client,
    categories: opts.categories,
    now: opts.now,
    model: opts.model,
  });
  return { drafts, usedAi: true };
}
