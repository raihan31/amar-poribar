import { z } from "zod";
import { CATEGORY_ICON_IDS } from "./icons.js";

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
export const BdPhoneSchema = z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Invalid Bangladeshi mobile number");

/** Normalise a BD phone number to +8801XXXXXXXXX. */
export function normalizeBdPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `+88${digits.slice(-11)}`;
}

/** `POST /v1/auth/otp/request` (T-ID-04). */
export const OtpRequestSchema = z.object({ phone: BdPhoneSchema });
export type OtpRequestInput = z.infer<typeof OtpRequestSchema>;

/** `POST /v1/auth/otp/verify` (T-ID-04). */
export const OtpVerifySchema = z.object({
  phone: BdPhoneSchema,
  code: z.string().regex(/^\d{6}$/),
  deviceId: z.string().min(1).max(200).optional(),
});
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;

export const OtpRequestResponseSchema = z.object({
  sent: z.literal(true),
  resendInSeconds: z.number().int(),
  /** Only outside production with the fake SMS gateway. */
  devCode: z.string().optional(),
});

export const OtpVerifyResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    locale: z.string(),
    numeralStyle: z.enum(["bn", "latin"]),
    simpleMode: z.boolean(),
  }),
  isNewUser: z.boolean(),
  /** Present (true) when the user asked for erasure and may still cancel it. */
  erasurePending: z.literal(true).optional(),
});

/** Upper bound per transaction: ৳1 crore, in paisa. */
export const MAX_AMOUNT_PAISA = 1_00_00_000 * 100;

export const AmountPaisaSchema = z.number().int().positive().max(MAX_AMOUNT_PAISA);

export const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");

/** A transfer needs a destination different from its source; every other type has none (T-LED-08). */
const transferShapeOk = (v: { type: string; accountId?: string | null; toAccountId?: string | null }) =>
  v.type === "transfer" ? Boolean(v.toAccountId) && v.toAccountId !== v.accountId : !v.toAccountId;
const TRANSFER_SHAPE_MESSAGE =
  "A transfer needs a destination account different from the source; other types have none";

export const CreateTransactionSchema = z
  .object({
    id: z.uuid().optional(),
    type: TransactionTypeSchema,
    amountPaisa: AmountPaisaSchema,
    feePaisa: z.number().int().min(0).default(0),
    occurredAt: z.iso.datetime({ offset: true }),
    categoryId: z.uuid().nullable().optional(),
    accountId: z.uuid().nullable().optional(),
    /** Destination of a transfer (T-LED-08). */
    toAccountId: z.uuid().nullable().optional(),
    note: z.string().max(500).optional(),
    counterparty: z.string().max(120).optional(),
    trxId: z.string().max(40).optional(),
    source: TransactionSourceSchema.default("manual"),
    aiConfidence: z.number().min(0).max(1).optional(),
    isPrivate: z.boolean().default(false),
    /** Admins may record an entry on behalf of another member (T-LED-04); defaults to the caller. */
    paidByUserId: z.uuid().optional(),
  })
  .refine(transferShapeOk, { message: TRANSFER_SHAPE_MESSAGE, path: ["toAccountId"] });
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
    toAccountId: z.uuid().nullable(),
    note: z.string().max(500).nullable(),
    counterparty: z.string().max(120).nullable(),
    isPrivate: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update")
  // Only what is visible in the body can be checked here; the service checks the merged row.
  .refine((v) => !v.toAccountId || (v.toAccountId !== v.accountId && v.type !== "expense" && v.type !== "income"), {
    message: TRANSFER_SHAPE_MESSAGE,
    path: ["toAccountId"],
  });
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;

/** Longest range a list may cover, in calendar months (FR-TXN-02). */
export const MAX_LIST_RANGE_MONTHS = 24;
const DaySchema = z.iso.date();

/** Query of `GET /v1/families/:id/transactions` (T-LED-05). `from`/`to` are Asia/Dhaka days, both inclusive. */
export const ListTransactionsQuerySchema = z
  .object({
    month: MonthSchema.optional(),
    from: DaySchema.optional(),
    to: DaySchema.optional(),
    categoryId: z.uuid().optional(),
    memberId: z.uuid().optional(),
    accountId: z.uuid().optional(),
    type: TransactionTypeSchema.optional(),
    source: TransactionSourceSchema.optional(),
    q: z.string().trim().max(50).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).max(300).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.month && (v.from || v.to)) ctx.addIssue({ code: "custom", message: "Use month or from/to, not both" });
    if (v.from && v.to) {
      if (v.to < v.from) ctx.addIssue({ code: "custom", message: "to is before from", path: ["to"] });
      const limit = new Date(`${v.from}T00:00:00Z`);
      limit.setUTCMonth(limit.getUTCMonth() + MAX_LIST_RANGE_MONTHS);
      if (new Date(`${v.to}T00:00:00Z`) >= limit)
        ctx.addIssue({ code: "custom", message: `Range is longer than ${MAX_LIST_RANGE_MONTHS} months`, path: ["to"] });
    }
  });
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;

export const TransactionListItemSchema = z.object({
  id: z.uuid(),
  type: TransactionTypeSchema,
  amountPaisa: z.number().int(),
  feePaisa: z.number().int(),
  occurredAt: z.string(),
  /** `YYYY-MM-DD` in Asia/Dhaka, for grouping by day. */
  dayKey: z.string(),
  categoryId: z.uuid().nullable(),
  categoryNameBn: z.string().nullable(),
  categoryNameEn: z.string().nullable(),
  accountId: z.uuid().nullable(),
  accountName: z.string().nullable(),
  paidByUserId: z.uuid().nullable(),
  paidByName: z.string().nullable(),
  createdBy: z.uuid(),
  note: z.string().nullable(),
  counterparty: z.string().nullable(),
  source: TransactionSourceSchema,
  isPrivate: z.boolean(),
  isMine: z.boolean(),
  hasAttachment: z.boolean(),
});
export type TransactionListItem = z.infer<typeof TransactionListItemSchema>;

/** One transaction for the detail screen (FR-TXN-10): the list item plus what only the detail needs. */
export const TransactionDetailSchema = TransactionListItemSchema.extend({
  trxId: z.string().nullable(),
  aiConfidence: z.number().nullable(),
  splitGroupId: z.uuid().nullable(),
  toAccountId: z.uuid().nullable(),
  attachmentUrl: z.string().nullable(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TransactionDetail = z.infer<typeof TransactionDetailSchema>;

export const TransactionPageSchema = z.object({
  items: z.array(TransactionListItemSchema),
  nextCursor: z.string().nullable(),
});
export type TransactionPage = z.infer<typeof TransactionPageSchema>;

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
  /** True when AI was skipped only because the family's monthly quota is used up (FR-AI-12). */
  quotaExhausted: z.boolean().optional(),
});
export type ParseResponse = z.infer<typeof ParseResponseSchema>;

export const CreateFamilySchema = z.object({
  name: z.string().trim().min(1).max(80),
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
  icon: z.enum(CATEGORY_ICON_IDS).optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z
  .object({
    nameEn: z.string().min(1).max(60),
    nameBn: z.string().min(1).max(60),
    icon: z.enum(CATEGORY_ICON_IDS).nullable(),
    isHidden: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

/** Set budgets for a month. `categoryId: null` is the overall family budget; a limit of 0 clears it (FR-BUD-01). */
export const PutBudgetsSchema = z.object({
  budgets: z
    .array(
      z.object({
        categoryId: z.uuid().nullable(),
        limitPaisa: z
          .number()
          .int()
          .min(0)
          .max(MAX_AMOUNT_PAISA * 100),
      }),
    )
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
    limitPaisa: z
      .number()
      .int()
      .positive()
      .max(MAX_AMOUNT_PAISA * 100),
  })
  .refine((v) => v.endsOn >= v.startsOn, "endsOn must not be before startsOn");
export type CreateFestivalBudgetInput = z.infer<typeof CreateFestivalBudgetSchema>;

export const UpdateFestivalBudgetSchema = z
  .object({
    name: z.string().min(1).max(80),
    startsOn: DateOnlySchema,
    endsOn: DateOnlySchema,
    limitPaisa: z
      .number()
      .int()
      .positive()
      .max(MAX_AMOUNT_PAISA * 100),
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
    endsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
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
    endsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    remindDaysBefore: z.number().int().min(0).max(14),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateRecurringInput = z.infer<typeof UpdateRecurringSchema>;

export const AskRequestSchema = z.object({
  question: z.string().min(1).max(500),
  /** True when the answer will be read aloud (voice conversation, FR-VOICE-08). */
  forSpeech: z.boolean().default(false),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

/** Receipt photo as base64 (about 5 MB of image, FR-TXN-07). */
export const ReceiptRequestSchema = z.object({
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  imageBase64: z
    .string()
    .min(100, "Image is empty")
    .max(7_000_000, "Image is too large (limit about 5 MB)")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Expected base64 image data"),
});
export type ReceiptRequest = z.infer<typeof ReceiptRequestSchema>;

const HlcSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-[0-9A-F]{4}-.+$/, "Not an HLC");

/** A transaction as exchanged by sync (SRS §4.3.1). The same JSON the mobile app stores. */
export const SyncTransactionSchema = z.object({
  id: z.uuid(),
  type: TransactionTypeSchema,
  amountPaisa: AmountPaisaSchema,
  feePaisa: z.number().int().min(0).default(0),
  occurredAt: z.iso.datetime({ offset: true }),
  categoryId: z.uuid().nullable().optional(),
  accountId: z.uuid().nullable().optional(),
  /** Optional so existing mobile builds keep working (T-LED-08). */
  toAccountId: z.uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  counterparty: z.string().max(120).nullable().optional(),
  trxId: z.string().max(40).nullable().optional(),
  source: TransactionSourceSchema.default("manual"),
  isPrivate: z.boolean().default(false),
  /** Set when the record was deleted; the row stays as a tombstone with a newer `hlc`. */
  deletedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  hlc: HlcSchema,
});
export type SyncTransaction = z.infer<typeof SyncTransactionSchema>;

export const SyncRequestSchema = z.object({
  nodeId: z.string().min(1).max(64),
  /** Opaque cursor from the previous response; null on a first sync. */
  cursor: z
    .string()
    .regex(/^\d{1,18}$/)
    .nullable()
    .default(null),
  changes: z.object({ transactions: z.array(z.unknown()).max(500).default([]) }).default({ transactions: [] }),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

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

export const NumeralStyleSchema = z.enum(["bn", "latin"]);

/** `PATCH /v1/me`: any subset of the identity-owned profile fields (FR-AUTH-04). */
export const UpdateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(60).nullable(),
    locale: LocaleSchema,
    numeralStyle: NumeralStyleSchema,
    simpleMode: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const UserProfileSchema = z.object({
  id: z.uuid(),
  phone: z.string(),
  name: z.string().nullable(),
  locale: LocaleSchema,
  numeralStyle: NumeralStyleSchema,
  simpleMode: z.boolean(),
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

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

/** Error envelope returned for every 4xx/5xx response (SRS §5.2). */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
