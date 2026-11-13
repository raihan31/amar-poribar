import { AiUnavailableError, parseReceipt } from "@amar-poribar/ai";
import type { ParseResponse } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import type { AiDeps } from "./deps.js";
import { hasAiQuota, recordAiUse } from "./quota.js";

/** Receipt or memo photo → drafts to confirm (FR-AI-09). The image is read once and not stored. */
export async function receipt(
  deps: AiDeps,
  familyId: string,
  image: { imageBase64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" },
): Promise<ParseResponse> {
  if (!deps.client) throw new HttpError(503, "ai_unavailable", "Receipt reading is not available right now");
  if (!(await hasAiQuota(deps, familyId)))
    throw new HttpError(429, "ai_quota", "This month's AI limit has been reached");
  const categories = (await deps.ledger.listCategories(familyId)).filter((c) => !c.isHidden);
  try {
    const drafts = await parseReceipt(
      { base64: image.imageBase64, mediaType: image.mediaType },
      { client: deps.client, categories, model: deps.model },
    );
    await recordAiUse(deps, familyId);
    return { drafts, usedAi: true };
  } catch (err) {
    if (err instanceof AiUnavailableError)
      throw new HttpError(503, "ai_unavailable", "Couldn't read that photo; please enter it manually");
    throw err;
  }
}
