import { AiUnavailableError, parseReceipt } from "@amar-poribar/ai";
import type { ParseResponse } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import type { AiDeps } from "./deps.js";
import { withMetering } from "./metering.js";
import { assertFeature, checkQuota, quotaError, withReservation } from "./quota.js";

/** Receipt or memo photo → drafts to confirm (FR-AI-09). The image is read once and not stored. */
export async function receipt(
  deps: AiDeps,
  familyId: string,
  image: { imageBase64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" },
): Promise<ParseResponse> {
  await assertFeature(deps, familyId, "receipt");
  const { client, model } = deps.claude;
  if (!client) throw new HttpError(503, "ai_unavailable", "Receipt reading is not available right now");
  const categories = await deps.ledger.listCategories(familyId, { includeHidden: false });
  try {
    const reserved = await withReservation(deps, "receipt", familyId, async () => {
      const drafts = await withMetering(deps, "receipt", familyId, (onUsage) =>
        parseReceipt({ base64: image.imageBase64, mediaType: image.mediaType }, { client, categories, model, onUsage }),
      );
      return { value: drafts, usedAi: true };
    });
    if (!reserved) throw quotaError(await checkQuota(deps, familyId));
    return { drafts: reserved.value, usedAi: true };
  } catch (err) {
    if (err instanceof AiUnavailableError)
      throw new HttpError(503, "ai_unavailable", "Couldn't read that photo; please enter it manually");
    throw err;
  }
}
