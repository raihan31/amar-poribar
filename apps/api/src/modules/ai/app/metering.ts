import { AiUnavailableError, type AiUsage } from "@amar-poribar/ai";
import { currentDhakaMonth } from "../../ledger/index.js";
import type { AiDeps, AiFeature } from "./deps.js";

/**
 * Runs an AI call and records what it cost (FR-AI-14): one `requests` per call that reached the model,
 * token sums, summed latency, and `errors` when the model was unavailable. Only numbers are stored,
 * never prompts, answers or user text (SRS 5.2). A call that never reached the model records nothing.
 */
export async function withMetering<T>(
  deps: AiDeps,
  feature: AiFeature,
  familyId: string,
  fn: (onUsage: (u: AiUsage) => void) => Promise<T>,
): Promise<T> {
  const total = { requests: 0, inputTokens: 0, outputTokens: 0, latencyMsSum: 0, errors: 0 };
  const onUsage = (u: AiUsage) => {
    total.requests = 1;
    total.inputTokens += u.inputTokens;
    total.outputTokens += u.outputTokens;
    total.latencyMsSum += u.latencyMs;
  };
  const flush = () => {
    if (total.requests === 0 && total.errors === 0) return Promise.resolve();
    return deps.store.recordMetering(familyId, currentDhakaMonth(deps.clock()), feature, total);
  };
  try {
    const result = await fn(onUsage);
    await flush();
    return result;
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      // A failed call is an error, not a counted request; tokens it did burn are still recorded.
      total.requests = 0;
      total.errors = 1;
      await flush();
    }
    throw err;
  }
}
