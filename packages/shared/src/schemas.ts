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

/** Editable fields only; TrxID and source are fixed once recorded (FR-TXN-03, FR-TXN-04). */
export const UpdateTransactionSchema = z
  .object({
    type: TransactionTypeSchema,
    amountPaisa: AmountPaisaSchema,
    feePaisa: z.number().int().min(0),
    occurredAt: z.iso.datetime({ offset: true }),
    categoryId: z.uuid().nullable(),
    accountId: z.uuid().nullable(),
    note: z.string().max(500).nullable(),
    counterparty: z.string().max(120).nullable(),
    isPrivate: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;

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

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(80),
  type: AccountTypeSchema,
  /** Member who owns the account, e.g. "Ammu's bKash". Null/omitted means shared (FR-ACC-02). */
  ownerUserId: z.uuid().nullable().optional(),
  openingBalancePaisa: z.number().int().default(0),
});
export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

export const UpdateAccountSchema = z
  .object({
    name: z.string().min(1).max(80),
    ownerUserId: z.uuid().nullable(),
    openingBalancePaisa: z.number().int(),
    archived: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;

export const CreateCategorySchema = z.object({
  kind: z.enum(["expense", "income"]),
  nameEn: z.string().min(1).max(60),
  nameBn: z.string().min(1).max(60),
  icon: z.string().max(16).optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z
  .object({
    nameEn: z.string().min(1).max(60),
    nameBn: z.string().min(1).max(60),
    icon: z.string().max(16).nullable(),
    isHidden: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

/** Set budgets for a month. `categoryId: null` is the overall family budget; a limit of 0 clears it (FR-BUD-01). */
export const PutBudgetsSchema = z.object({
  budgets: z
    .array(z.object({ categoryId: z.uuid().nullable(), limitPaisa: z.number().int().min(0).max(MAX_AMOUNT_PAISA * 100) }))
    .min(1)
    .max(100),
});
export type PutBudgetsInput = z.infer<typeof PutBudgetsSchema>;

const BreakdownRowSchema = z.object({ id: z.string().nullable(), name: z.string(), totalPaisa: z.number().int() });
export type BreakdownRow = z.infer<typeof BreakdownRowSchema>;

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** One-off festival budget over a date range, e.g. Eid-ul-Adha (FR-BUD-04). Dates are Asia/Dhaka days, inclusive. */
export const CreateFestivalBudgetSchema = z
  .object({
    name: z.string().min(1).max(80),
    startsOn: DateOnlySchema,
    endsOn: DateOnlySchema,
    limitPaisa: z.number().int().positive().max(MAX_AMOUNT_PAISA * 100),
  })
  .refine((v) => v.endsOn >= v.startsOn, "endsOn must not be before startsOn");
export type CreateFestivalBudgetInput = z.infer<typeof CreateFestivalBudgetSchema>;

export const UpdateFestivalBudgetSchema = z
  .object({
    name: z.string().min(1).max(80),
    startsOn: DateOnlySchema,
    endsOn: DateOnlySchema,
    limitPaisa: z.number().int().positive().max(MAX_AMOUNT_PAISA * 100),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateFestivalBudgetInput = z.infer<typeof UpdateFestivalBudgetSchema>;

/** Monthly recurring entry such as rent or a helper's salary (FR-TXN-06, FR-NOT-03). */
export const CreateRecurringSchema = z
  .object({
    name: z.string().min(1).max(80),
    type: z.enum(["expense", "income"]).default("expense"),
    amountPaisa: AmountPaisaSchema,
    categoryId: z.uuid().nullable().optional(),
    accountId: z.uuid().nullable().optional(),
    /** Day of month, 1..31. Shorter months use their last day. */
    dayOfMonth: z.number().int().min(1).max(31),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    /** Remind this many days before the due date. */
    remindDaysBefore: z.number().int().min(0).max(14).default(2),
  })
  .refine((v) => !v.endsOn || v.endsOn >= v.startsOn, "endsOn must not be before startsOn");
export type CreateRecurringInput = z.infer<typeof CreateRecurringSchema>;

export const UpdateRecurringSchema = z
  .object({
    name: z.string().min(1).max(80),
    amountPaisa: AmountPaisaSchema,
    categoryId: z.uuid().nullable(),
    accountId: z.uuid().nullable(),
    dayOfMonth: z.number().int().min(1).max(31),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    remindDaysBefore: z.number().int().min(0).max(14),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateRecurringInput = z.infer<typeof UpdateRecurringSchema>;

export const MonthSummarySchema = z.object({
  month: MonthSchema,
  incomePaisa: z.number().int(),
  expensePaisa: z.number().int(),
  /** Totals for the month before, for the comparison in FR-REP-01. */
  previous: z.object({ month: MonthSchema, incomePaisa: z.number().int(), expensePaisa: z.number().int() }),
  byCategory: z.array(z.object({ categoryId: z.string().nullable(), name: z.string(), totalPaisa: z.number().int() })),
  /** Expense by who paid (FR-REP-02). */
  byMember: z.array(BreakdownRowSchema),
  /** Expense by account (FR-REP-02). */
  byAccount: z.array(BreakdownRowSchema),
});
export type MonthSummary = z.infer<typeof MonthSummarySchema>;

export const LocaleSchema = z.enum(["bn", "en"]);

export const SummaryQuerySchema = z.object({
  month: MonthSchema.optional(),
  locale: LocaleSchema.default("bn"),
});

/** Monthly AI summary (SRS FR-AI-11): `text` for the screen, `speechText` for text-to-speech. */
export const MonthlyAiSummarySchema = z.object({
  month: MonthSchema,
  locale: LocaleSchema,
  text: z.string(),
  speechText: z.string(),
  usedAi: z.boolean(),
});
export type MonthlyAiSummary = z.infer<typeof MonthlyAiSummarySchema>;
