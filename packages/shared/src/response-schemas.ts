import { z } from "zod";
import {
  AccountTypeSchema,
  ApiErrorSchema,
  MonthlyAiSummarySchema,
  MonthSummarySchema,
  ParseResponseSchema,
  RoleSchema,
  SyncRequestSchema,
  SyncTransactionSchema,
  TransactionDraftSchema,
  TransactionSourceSchema,
  TransactionTypeSchema,
} from "./schemas.js";

/**
 * Wire shapes of API responses as JSON (dates are ISO strings). Strict, so a missing or an extra field in a
 * contract vector fails. Used by `vectors.test.ts` and `tools/gen-vectors.ts` (T-PLAT-16).
 */
const iso = z.iso.datetime({ offset: true });
const id = z.uuid();

export const MeResponseSchema = z.strictObject({
  user: z.strictObject({
    id,
    phone: z.string(),
    name: z.string().nullable(),
    locale: z.enum(["bn", "en"]),
    bnDigits: z.boolean(),
    createdAt: iso,
    updatedAt: iso,
  }),
  families: z.array(z.strictObject({ id, name: z.string(), role: RoleSchema })),
});

export const FamilyResponseSchema = z.strictObject({
  id,
  name: z.string(),
  currency: z.string(),
  plan: z.string(),
  aiQuotaMonth: z.number().int(),
  createdBy: id,
  createdAt: iso,
  updatedAt: iso,
});

export const MemberResponseSchema = z.strictObject({
  userId: id,
  role: RoleSchema,
  name: z.string().nullable(),
  phone: z.string(),
});

export const AccountResponseSchema = z.strictObject({
  id,
  familyId: id,
  name: z.string(),
  type: AccountTypeSchema,
  ownerUserId: id.nullable(),
  openingBalancePaisa: z.number().int(),
  archivedAt: iso.nullable(),
  createdAt: iso,
  updatedAt: iso,
});

export const CategoryResponseSchema = z.strictObject({
  id,
  familyId: id,
  key: z.string(),
  kind: z.enum(["expense", "income"]),
  nameEn: z.string(),
  nameBn: z.string(),
  icon: z.string().nullable(),
  isHidden: z.boolean(),
});

export const TransactionResponseSchema = z.strictObject({
  id,
  familyId: id,
  type: TransactionTypeSchema,
  amountPaisa: z.number().int(),
  feePaisa: z.number().int(),
  occurredAt: iso,
  categoryId: id.nullable(),
  accountId: id.nullable(),
  paidByUserId: id.nullable(),
  note: z.string().nullable(),
  counterparty: z.string().nullable(),
  trxId: z.string().nullable(),
  source: TransactionSourceSchema,
  aiConfidence: z.number().min(0).max(1).nullable(),
  isPrivate: z.boolean(),
  createdBy: id,
  deletedAt: iso.nullable(),
  hlc: z.string(),
  syncSeq: z.number().int(),
  createdAt: iso,
  updatedAt: iso,
});

export const BudgetListResponseSchema = z.strictObject({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  budgets: z.array(
    z.strictObject({
      categoryId: id.nullable(),
      nameEn: z.string(),
      nameBn: z.string(),
      limitPaisa: z.number().int(),
      spentPaisa: z.number().int(),
      level: z.enum(["ok", "warning", "exceeded"]),
      inherited: z.boolean(),
    }),
  ),
});

export const SyncResponseSchema = z.strictObject({
  cursor: z.string().regex(/^\d{1,18}$/),
  more: z.boolean(),
  applied: z.number().int().min(0),
  rejected: z.array(z.strictObject({ id: z.string().nullable(), reason: z.string() })),
  changes: z.strictObject({ transactions: z.array(SyncTransactionSchema) }),
});

/** Fixture file name (without `.json`) to the schema its `body` must satisfy. */
export const VECTOR_SCHEMAS = {
  me: MeResponseSchema,
  family: FamilyResponseSchema,
  member: z.array(MemberResponseSchema),
  account: AccountResponseSchema,
  category: CategoryResponseSchema,
  transaction: TransactionResponseSchema,
  "transaction-list": z.array(TransactionResponseSchema),
  draft: TransactionDraftSchema.strict(),
  "parse-response": ParseResponseSchema,
  "summary-month": MonthSummarySchema,
  "monthly-ai-summary": MonthlyAiSummarySchema,
  "budget-list": BudgetListResponseSchema,
  "sync-request": SyncRequestSchema,
  "sync-response": SyncResponseSchema,
  error: ApiErrorSchema,
  errors: z.array(ApiErrorSchema),
} as const;

export type VectorName = keyof typeof VECTOR_SCHEMAS;
