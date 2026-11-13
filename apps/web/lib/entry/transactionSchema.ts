import { z } from "zod";
import { MAX_AMOUNT_PAISA, parseAmountToPaisa } from "@amar-poribar/shared";

const DAY_MS = 86_400_000;

/** Error messages are i18n keys; the form translates them. */
export const transactionFormSchema = z
  .object({
    type: z.enum(["expense", "income", "transfer"]),
    /** Whole taka as typed (Latin or Bangla digits). */
    amount: z.string(),
    categoryId: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    paidByUserId: z.string().optional(),
    day: z.enum(["today", "yesterday", "other"]),
    /** YYYY-MM-DD, used when `day` is "other". */
    date: z.string(),
    note: z.string().max(500),
    /** Optional mobile-banking fee in taka. */
    fee: z.string(),
    isPrivate: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const paisa = parseAmountToPaisa(v.amount);
    if (paisa === null || paisa < 100 || paisa > MAX_AMOUNT_PAISA) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "entry.form.amountBad" });
    }
    if (v.day === "other" && !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
      ctx.addIssue({ code: "custom", path: ["date"], message: "entry.form.dateBad" });
    }
    if (v.fee.trim() !== "" && parseAmountToPaisa(v.fee) === null) {
      ctx.addIssue({ code: "custom", path: ["fee"], message: "entry.form.amountBad" });
    }
  })
  .transform((v) => ({
    ...v,
    amountPaisa: parseAmountToPaisa(v.amount) ?? 0,
    feePaisa: v.fee.trim() === "" ? 0 : (parseAmountToPaisa(v.fee) ?? 0),
  }));

export type TransactionFormValues = z.input<typeof transactionFormSchema>;
export type TransactionFormParsed = z.output<typeof transactionFormSchema>;

/** The moment to record: now, 24 hours ago, or noon (Dhaka) on the chosen date. */
export function occurredAtFor(day: "today" | "yesterday" | "other", date: string, now: Date = new Date()): string {
  if (day === "today") return now.toISOString();
  if (day === "yesterday") return new Date(now.getTime() - DAY_MS).toISOString();
  return new Date(`${date}T12:00:00+06:00`).toISOString();
}

/** Body for `POST /v1/families/:id/transactions`; `id` is the client UUID that makes retries safe. */
export function toCreateBody(v: TransactionFormParsed, id: string, meId: string | undefined, now = new Date()) {
  const noCategory = v.type === "transfer";
  return {
    id,
    type: v.type,
    amountPaisa: v.amountPaisa,
    feePaisa: v.feePaisa,
    occurredAt: occurredAtFor(v.day, v.date, now),
    categoryId: noCategory ? null : (v.categoryId ?? null),
    accountId: v.accountId ?? null,
    note: v.note.trim() || undefined,
    source: "manual" as const,
    isPrivate: v.isPrivate,
    paidByUserId: v.paidByUserId && v.paidByUserId !== meId ? v.paidByUserId : undefined,
  };
}
