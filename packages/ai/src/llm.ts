import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  ACCOUNT_TYPES,
  MAX_AMOUNT_PAISA,
  takaToPaisa,
  type TransactionDraft,
} from "@amar-poribar/shared";
import { maskPhone } from "./sms.js";

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface CategoryOption {
  key: string;
  nameEn: string;
  nameBn: string;
  kind: "expense" | "income";
}

/** Shape the model must return (structured outputs). Amounts are in taka; we convert to paisa. */
const LlmDraftsSchema = z.object({
  drafts: z.array(
    z.object({
      type: z.enum(["expense", "income", "transfer"]),
      amountTaka: z.number(),
      feeTaka: z.number(),
      date: z.string().describe("YYYY-MM-DD in Asia/Dhaka"),
      categoryKey: z.string().nullable(),
      accountType: z.enum(ACCOUNT_TYPES).nullable(),
      note: z.string(),
      counterparty: z.string().nullable(),
      confidence: z.number(),
    }),
  ),
});

const SYSTEM_PROMPT = `You turn short notes about family spending in Bangladesh into structured transactions.

Input can be Bangla, English, or Banglish (Bangla in Latin letters), e.g.
"আজ বাজারে ৮৫০ টাকা ক্যাশে", "bazar 850 cash", "gotokal DESCO bill 2340 bkash e dilam", "Ammu ke 5000 pathalam".

Rules:
- One draft per distinct transaction mentioned. If nothing describes money spent, received or moved, return an empty list.
- Amounts are Bangladeshi taka. "k" means thousand, "লাখ/lakh" means 100,000. Never invent an amount.
- type: "expense" for spending or money sent to someone, "income" for salary/remittance/money received, "transfer" for moving money between the family's own accounts (e.g. cash out).
- categoryKey: choose only from the provided category keys, or null if unsure.
- accountType: cash, bkash, nagad, rocket, upay, bank, card or other, if the note says how it was paid; else null.
- date: resolve relative words (আজ/aj = today, গতকাল/gotokal = yesterday, পরশু = day before yesterday) against the given today date.
- note: a short human-readable description in the same language the user wrote in.
- confidence: 0-1, how sure you are about amount and category together.`;

export interface LlmParseOptions {
  client: Anthropic;
  categories: CategoryOption[];
  /** Current time, used for relative dates. */
  now?: Date;
  model?: string;
}

function dhakaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(now);
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/**
 * Parse free text into transaction drafts with Claude (SRS FR-AI-01).
 * Drafts are never saved directly; the user confirms them (FR-AI-05).
 */
export async function parseWithLlm(text: string, opts: LlmParseOptions): Promise<TransactionDraft[]> {
  const { client, categories, now = new Date(), model = DEFAULT_MODEL } = opts;
  const validKeys = new Set(categories.map((c) => c.key));
  const categoryList = categories.map((c) => `${c.key} (${c.kind}): ${c.nameEn} / ${c.nameBn}`).join("\n");
  const today = dhakaDate(now);

  const response = await client.beta.messages.parse({
    model,
    // If the model declines, the API retries on a fallback model it picks by refusal category.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: 4000,
    // Stable prefix first (system + categories) so prompt caching can reuse it across requests.
    system: [{ type: "text", text: `${SYSTEM_PROMPT}\n\nCategory keys:\n${categoryList}`, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Today (Asia/Dhaka): ${today}\n\nNote:\n${maskPhone(text)}` }],
    output_config: { effort: "low", format: betaZodOutputFormat(LlmDraftsSchema) },
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    throw new AiUnavailableError(`AI stopped with ${response.stop_reason}`);
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new AiUnavailableError("AI returned no structured output");

  const drafts: TransactionDraft[] = [];
  for (const d of parsed.drafts) {
    const amountPaisa = takaToPaisa(d.amountTaka);
    if (amountPaisa <= 0 || amountPaisa > MAX_AMOUNT_PAISA) continue;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : today;
    drafts.push({
      type: d.type,
      amountPaisa,
      feePaisa: Math.max(0, takaToPaisa(d.feeTaka)),
      // Same-day entries get the current time; past days default to noon Dhaka time.
      occurredAt: date === today ? now.toISOString() : `${date}T12:00:00+06:00`,
      categoryKey: d.categoryKey && validKeys.has(d.categoryKey) ? d.categoryKey : null,
      accountType: d.accountType,
      note: d.note,
      counterparty: d.counterparty,
      trxId: null,
      source: "ai_text",
      confidence: Math.min(1, Math.max(0, d.confidence)),
    });
  }
  return drafts;
}
