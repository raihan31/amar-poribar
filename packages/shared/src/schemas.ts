import { z } from "zod";

export const ACCOUNT_TYPES = ["cash", "bkash", "nagad", "rocket", "upay", "bank", "card", "other"] as const;
export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const ROLES = ["owner", "admin", "member", "viewer"] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const TransactionTypeSchema = z.enum(["expense", "income", "transfer"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionSourceSchema = z.enum(["manual", "ai_text", "sms", "voice", "receipt"]);
export type TransactionSource = z.infer<typeof TransactionSourceSchema>;

/** Bangladeshi mobile number, with or without +88 / 88 prefix (SRS FR-AUTH-02). */
export const BdPhoneSchema = z
  .string()
  .regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Invalid Bangladeshi mobile number");

/** Normalise a BD phone number to +8801XXXXXXXXX. */
export function normalizeBdPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `+88${digits.slice(-11)}`;
}

/** Upper bound per transaction: ৳1 crore, in paisa. */
export const MAX_AMOUNT_PAISA = 1_00_00_000 * 100;

export const AmountPaisaSchema = z.number().int().positive().max(MAX_AMOUNT_PAISA);

export const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");

export const CreateTransactionSchema = z.object({
  id: z.uuid().optional(),
  type: TransactionTypeSchema,
  amountPaisa: AmountPaisaSchema,
  feePaisa: z.number().int().min(0).default(0),
  occurredAt: z.iso.datetime({ offset: true }),
  categoryId: z.uuid().nullable().optional(),
  accountId: z.uuid().nullable().optional(),
  note: z.string().max(500).optional(),
  counterparty: z.string().max(120).optional(),
  trxId: z.string().max(40).optional(),
  source: TransactionSourceSchema.default("manual"),
  aiConfidence: z.number().min(0).max(1).optional(),
  isPrivate: z.boolean().default(false),
});
export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

/** A transaction proposed by the SMS parser or the AI, awaiting user confirmation (SRS FR-AI-05). */
export const TransactionDraftSchema = z.object({
  type: TransactionTypeSchema,
  amountPaisa: AmountPaisaSchema,
  feePaisa: z.number().int().min(0).default(0),
  occurredAt: z.string(),
  categoryKey: z.string().nullable(),
  accountType: AccountTypeSchema.nullable(),
  note: z.string(),
  counterparty: z.string().nullable(),
  trxId: z.string().nullable(),
  source: TransactionSourceSchema,
  confidence: z.number().min(0).max(1),
});
export type TransactionDraft = z.infer<typeof TransactionDraftSchema>;

export const ParseRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  /** Client's current time; used to resolve "আজ", "gotokal", etc. Defaults to server time. */
  now: z.iso.datetime({ offset: true }).optional(),
});
export type ParseRequest = z.infer<typeof ParseRequestSchema>;

export const ParseResponseSchema = z.object({
  drafts: z.array(TransactionDraftSchema),
  usedAi: z.boolean(),
});
export type ParseResponse = z.infer<typeof ParseResponseSchema>;

export const CreateFamilySchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateFamilyInput = z.infer<typeof CreateFamilySchema>;

export const MonthSummarySchema = z.object({
  month: MonthSchema,
  incomePaisa: z.number().int(),
  expensePaisa: z.number().int(),
  byCategory: z.array(z.object({ categoryId: z.string().nullable(), name: z.string(), totalPaisa: z.number().int() })),
});
export type MonthSummary = z.infer<typeof MonthSummarySchema>;
