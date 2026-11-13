import { AiUnavailableError, askQuestion } from "@amar-poribar/ai";
import { HttpError } from "../../../platform/errors.js";
import { buildAskTools } from "../infra/ask-tools.js";
import type { AiDeps } from "./deps.js";
import { withMetering } from "./metering.js";
import { assertFeature, checkQuota, quotaError, withReservation } from "./quota.js";

/** Ask a question about the family's data, typed or spoken (FR-AI-10, FR-VOICE-08). */
export async function ask(
  deps: AiDeps,
  input: { familyId: string; userId: string; question: string; forSpeech?: boolean | undefined },
): Promise<{ answer: string; usedAi: true }> {
  const { familyId, userId, question, forSpeech } = input;
  await assertFeature(deps, familyId, "ask");
  const { client, model } = deps.claude;
  if (!client) throw new HttpError(503, "ai_unavailable", "Ask is not available right now");
  try {
    const reserved = await withReservation(deps, "ask", familyId, async () => {
      const answer = await withMetering(deps, "ask", familyId, (onUsage) =>
        askQuestion(question, {
          client,
          tools: buildAskTools(deps.ledger, familyId, userId),
          today: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(deps.clock()),
          model,
          forSpeech,
          onUsage,
        }),
      );
      return { value: answer, usedAi: true };
    });
    if (!reserved) throw quotaError(await checkQuota(deps, familyId));
    return { answer: reserved.value, usedAi: true };
  } catch (err) {
    if (err instanceof AiUnavailableError)
      throw new HttpError(503, "ai_unavailable", "AI couldn't answer that right now");
    throw err;
  }
}
