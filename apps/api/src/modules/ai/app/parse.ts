import { AiUnavailableError, parseInput } from "@amar-poribar/ai";
import type { ParseResponse } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import type { AiDeps } from "./deps.js";
import { withMetering } from "./metering.js";
import { hasAiQuota } from "./quota.js";

/** Text, voice transcript or MFS SMS → drafts (FR-AI-01, FR-AI-02, FR-VOICE-02). */
export async function parse(deps: AiDeps, familyId: string, text: string, now?: string): Promise<ParseResponse> {
  const categories = await deps.ledger.listCategories(familyId, { includeHidden: false });
  try {
    const client = deps.claude.enabled && (await hasAiQuota(deps, familyId)) ? deps.claude.client : undefined;
    return await withMetering(deps, "parse", familyId, (onUsage) =>
      parseInput(text, {
        categories,
        now: now ? new Date(now) : deps.clock(),
        client,
        model: deps.claude.model,
        onUsage,
      }),
    );
  } catch (err) {
    if (err instanceof AiUnavailableError)
      throw new HttpError(503, "ai_unavailable", "AI couldn't read that; please enter it manually");
    throw err;
  }
}
