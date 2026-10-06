import type Anthropic from "@anthropic-ai/sdk";
import type { TransactionDraft } from "@amar-poribar/shared";
import { AiUnavailableError, parseWithLlm, type CategoryOption } from "./llm.js";
import { quickParse } from "./rules.js";
import { parseMfsSms } from "./sms.js";

export * from "./sms.js";
export * from "./llm.js";
export * from "./rules.js";

export interface ParseInputOptions {
  categories: CategoryOption[];
  now?: Date;
  /** When omitted, only the deterministic SMS parser runs. */
  client?: Anthropic;
  model?: string;
}

/**
 * Parse pipeline (SRS §6.1), cheapest first:
 * MFS SMS parser → offline keyword parser (one amount + known category) → LLM → partial offline draft.
 */
export async function parseInput(
  text: string,
  opts: ParseInputOptions,
): Promise<{ drafts: TransactionDraft[]; usedAi: boolean }> {
  const sms = parseMfsSms(text, opts.now);
  if (sms) return { drafts: [sms], usedAi: false };

  const quick = quickParse(text, opts.now);
  if (quick?.complete) return { drafts: [quick.draft], usedAi: false };

  if (opts.client) {
    try {
      const drafts = await parseWithLlm(text, {
        client: opts.client,
        categories: opts.categories,
        now: opts.now,
        model: opts.model,
      });
      return { drafts, usedAi: true };
    } catch (err) {
      // With a partial offline draft the user can still pick the category instead of retyping.
      if (!(err instanceof AiUnavailableError) || !quick) throw err;
    }
  }
  // Amount found but no category: offer it so the user only has to choose the category.
  return { drafts: quick ? [quick.draft] : [], usedAi: false };
}
export * from "./summary.js";
