import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { amountInWords, formatBDT, monthName, type Locale } from "@amar-poribar/shared";
import { AiUnavailableError, DEFAULT_MODEL } from "./llm.js";

/**
 * Monthly summary in plain language, for the screen and for text-to-speech (SRS FR-AI-11).
 *
 * The model never writes numbers. It refers to amounts with placeholders such as {TOTAL},
 * and we fill them in from the database totals: digits on screen, words when spoken.
 * This keeps every amount exact and keeps speech natural.
 */

export interface CategoryTotal {
  name: string;
  paisa: number;
  lastMonthPaisa: number;
}

export interface SummaryInput {
  month: string;
  locale: Locale;
  expensePaisa: number;
  incomePaisa: number;
  lastMonthExpensePaisa: number;
  /** Expense categories, largest first. */
  categories: CategoryTotal[];
}

export interface SummaryOutput {
  text: string;
  speechText: string;
}

interface Fact {
  id: string;
  paisa: number;
  description: string;
}

const MAX_CATEGORIES = 5;

export function buildFacts(input: SummaryInput): Fact[] {
  const facts: Fact[] = [
    { id: "TOTAL", paisa: input.expensePaisa, description: "total spent this month" },
    { id: "INCOME", paisa: input.incomePaisa, description: "total income this month" },
    { id: "LAST_TOTAL", paisa: input.lastMonthExpensePaisa, description: "total spent last month" },
    {
      id: "CHANGE",
      paisa: Math.abs(input.expensePaisa - input.lastMonthExpensePaisa),
      description: `difference from last month (spending went ${input.expensePaisa >= input.lastMonthExpensePaisa ? "UP" : "DOWN"})`,
    },
  ];
  input.categories.slice(0, MAX_CATEGORIES).forEach((c, i) => {
    facts.push({ id: `C${i + 1}`, paisa: c.paisa, description: `spent on "${c.name}" this month` });
    facts.push({ id: `C${i + 1}_LAST`, paisa: c.lastMonthPaisa, description: `spent on "${c.name}" last month` });
  });
  return facts;
}

const PLACEHOLDER = /\{([A-Z0-9_]+)\}/g;

/** Replace placeholders with amounts: digits for display, words for speech. */
export function renderSummary(template: string, facts: Fact[], locale: Locale): SummaryOutput {
  const byId = new Map(facts.map((f) => [f.id, f.paisa]));
  const fill = (fmt: (paisa: number) => string) =>
    template.replace(PLACEHOLDER, (m, id: string) => {
      const paisa = byId.get(id);
      return paisa === undefined ? m : fmt(paisa);
    });
  return {
    text: fill((p) => formatBDT(p, { bnDigits: locale === "bn" })),
    speechText: fill((p) => amountInWords(p, locale)),
  };
}

/** Deterministic summary, used when AI is off, out of quota, or returns something unusable. */
export function templateSummary(input: SummaryInput): SummaryOutput {
  const facts = buildFacts(input);
  const month = monthName(input.month, input.locale);
  const top = input.categories[0];
  const up = input.expensePaisa >= input.lastMonthExpensePaisa;
  const parts: string[] = [];

  if (input.locale === "en") {
    if (!input.expensePaisa) parts.push(`No expenses recorded for ${month} yet.`);
    else parts.push(`In ${month} the family spent {TOTAL}.`);
    if (input.expensePaisa && input.lastMonthExpensePaisa) parts.push(`That is {CHANGE} ${up ? "more" : "less"} than last month.`);
    if (top) parts.push(`The most went on ${top.name}: {C1}.`);
    if (input.incomePaisa) parts.push(`Income this month: {INCOME}.`);
  } else {
    if (!input.expensePaisa) parts.push(`${month} মাসে এখনো কোনো খরচ লেখা হয়নি।`);
    else parts.push(`${month} মাসে পরিবারের মোট খরচ {TOTAL}।`);
    if (input.expensePaisa && input.lastMonthExpensePaisa) parts.push(`গত মাসের চেয়ে {CHANGE} ${up ? "বেশি" : "কম"}।`);
    if (top) parts.push(`সবচেয়ে বেশি খরচ ${top.name} খাতে, {C1}।`);
    if (input.incomePaisa) parts.push(`এই মাসে আয় {INCOME}।`);
  }
  return renderSummary(parts.join(" "), facts, input.locale);
}

const SYSTEM_PROMPT = `You write a short monthly money summary for a Bangladeshi family. Some family members have little schooling, and the summary will also be read aloud by a phone.

Write 3 to 5 very short sentences:
- Use everyday spoken words, as a caring elder in the family would talk. No jargon, no percentages, no English words in a Bangla summary.
- Say the total spent, whether it went up or down from last month, and the one or two biggest areas of spending.
- If spending went up, give one small, practical, kind tip. Never blame any person.
- NEVER write any digit or number. Refer to amounts ONLY with the placeholders given, written exactly like {TOTAL} or {C1}. They will be replaced with the real amounts.
- Use category names and the month name exactly as given.`;

const LlmSummarySchema = z.object({ summary: z.string() });

export interface LlmSummaryOptions {
  client: Anthropic;
  model?: string;
}

export async function summarizeWithLlm(input: SummaryInput, opts: LlmSummaryOptions): Promise<SummaryOutput> {
  const facts = buildFacts(input);
  const factLines = facts.map((f) => `{${f.id}} = ${(f.paisa / 100).toFixed(0)} taka (${f.description})`).join("\n");
  const language = input.locale === "bn" ? "Bangla (Bengali script)" : "simple English";

  const response = await opts.client.beta.messages.parse({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Language: ${language}\nMonth: ${monthName(input.month, input.locale)}\n\nPlaceholders:\n${factLines}`,
      },
    ],
    output_config: { effort: "low", format: betaZodOutputFormat(LlmSummarySchema) },
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    throw new AiUnavailableError(`AI stopped with ${response.stop_reason}`);
  }
  const summary = response.parsed_output?.summary?.trim();
  if (!summary) throw new AiUnavailableError("AI returned no summary");
  assertSafeTemplate(summary, facts);
  return renderSummary(summary, facts, input.locale);
}

/** Reject output with unknown placeholders or hand-written numbers, so no amount is ever invented. */
export function assertSafeTemplate(template: string, facts: Fact[]): void {
  const ids = new Set(facts.map((f) => f.id));
  for (const [, id] of template.matchAll(PLACEHOLDER)) {
    if (!ids.has(id!)) throw new AiUnavailableError(`Unknown placeholder {${id}}`);
  }
  if (/[0-9০-৯]/.test(template.replace(PLACEHOLDER, ""))) {
    throw new AiUnavailableError("Summary contains numbers outside placeholders");
  }
  if (template.length > 1000) throw new AiUnavailableError("Summary too long");
}

/** AI summary when a client is given, falling back to the template on any AI problem. */
export async function monthlySummary(
  input: SummaryInput,
  opts: Partial<LlmSummaryOptions> = {},
): Promise<SummaryOutput & { usedAi: boolean }> {
  if (opts.client && input.expensePaisa > 0) {
    try {
      return { ...(await summarizeWithLlm(input, { client: opts.client, model: opts.model })), usedAi: true };
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) throw err;
    }
  }
  return { ...templateSummary(input), usedAi: false };
}
