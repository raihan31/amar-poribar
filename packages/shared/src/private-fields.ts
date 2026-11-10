// Property names that carry family-private data. A facade function tagged `@staff-safe`
// must not return any of them at any depth (SRS 11.3, DEC-18). Enforced by
// tools/eslint-rules/staff-safe.mjs. Keep this a plain array: the ESLint rule imports it directly.
export const PRIVATE_FIELDS = [
  "amountPaisa",
  "feePaisa",
  "note",
  "counterparty",
  "trxId",
  "body",
  "mediaId",
  "storageKey",
  "phone",
  "token",
  "fcmToken",
  "email",
  "personName",
  "personPhone",
  "transcript",
  "receiptUrl",
  "ciphertext",
  "otp",
] as const;

export type PrivateField = (typeof PRIVATE_FIELDS)[number];
