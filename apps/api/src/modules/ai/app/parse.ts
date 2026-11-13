import { AiUnavailableError, parseInput, parseMfsSms, quickParse } from "@amar-poribar/ai";
import type { ParseResponse } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import type { AiDeps } from "./deps.js";
import { withMetering } from "./metering.js";
import { withReservation } from "./quota.js";

/** Text, voice transcript or MFS SMS → drafts (FR-AI-01, FR-AI-02, FR-VOICE-02). */
export async function parse(deps: AiDeps, familyId: string, text: string, now?: string): Promise<ParseResponse> {
  const categories = await deps.ledger.listCategories(familyId, { includeHidden: false });
  const at = now ? new Date(now) : deps.clock();
  const base = { categories, now: at, model: deps.claude.model };

  // Deterministic parsers answer first and are free: no reservation, no quota check.
  if (parseMfsSms(text, at) || quickParse(text, at)?.complete || !deps.claude.enabled) return parseInput(text, base);

  try {
    const reserved = await withReservation(deps, "parse", familyId, async () => {
      const value = await withMetering(deps, "parse", familyId, (onUsage) =>
        parseInput(text, { ...base, client: deps.claude.client, onUsage }),
      );
      return { value, usedAi: value.usedAi };
    });
    if (reserved) return reserved.value;
    // Quota used up: keep the amount-only draft so the user can still pick a category by hand.
    return { ...(await parseInput(text, base)), quotaExhausted: true };
  } catch (err) {
    if (err instanceof AiUnavailableError)
      throw new HttpError(503, "ai_unavailable", "AI couldn't read that; please enter it manually");
    throw err;
  }
}
