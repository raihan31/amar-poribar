/**
 * Regenerates packages/shared/test-vectors/api/*.json from the builders below and writes sorted JSON.
 *
 *   pnpm exec tsx tools/gen-vectors.ts          write the fixtures
 *   pnpm exec tsx tools/gen-vectors.ts --check  fail when committed fixtures differ (CI)
 *
 * The builders are self-contained because tools/fixtures (T-PLAT-20) does not exist yet. When it lands, replace the
 * constants with its builders; the output must stay byte-identical. Every value is synthetic.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import { VECTOR_SCHEMAS, type VectorName } from "../packages/shared/src/response-schemas.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "packages/shared/test-vectors/api");

const FAMILY = "00000000-0000-4000-8000-000000000001";
const RAHIM = "00000000-0000-4000-8000-0000000000a1";
const KARIMA = "00000000-0000-4000-8000-0000000000a2";
const ACCOUNT = "00000000-0000-4000-8000-0000000000b1";
const CATEGORY = "00000000-0000-4000-8000-0000000000c1";
const TXN1 = "00000000-0000-4000-8000-0000000000d1";
const TXN2 = "00000000-0000-4000-8000-0000000000d2";
const T0 = "2026-10-05T08:22:00.000Z";
const T1 = "2026-11-09T10:00:00.000Z";

const txn = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  familyId: FAMILY,
  type: "expense",
  amountPaisa: 85000,
  feePaisa: 0,
  occurredAt: T0,
  categoryId: CATEGORY,
  accountId: ACCOUNT,
  paidByUserId: RAHIM,
  note: "বাজার",
  counterparty: null,
  trxId: null,
  source: "manual",
  aiConfidence: null,
  isPrivate: false,
  createdBy: RAHIM,
  deletedAt: null,
  hlc: "2026-10-05T08:22:00.000Z-0000-node-1",
  syncSeq: 1,
  createdAt: T0,
  updatedAt: T0,
  ...over,
});

const draft = {
  type: "expense",
  amountPaisa: 150000,
  feePaisa: 500,
  occurredAt: "2026-10-05T14:22:00+06:00",
  categoryKey: null,
  accountType: "bkash",
  note: "আম্মুকে পাঠানো",
  counterparty: "01XXXXXX678",
  trxId: "BJ51AB12CD",
  source: "sms",
  confidence: 0.95,
};

const syncTxn = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: "expense",
  amountPaisa: 85000,
  feePaisa: 0,
  occurredAt: T0,
  categoryId: CATEGORY,
  accountId: ACCOUNT,
  note: "বাজার",
  counterparty: null,
  trxId: null,
  source: "manual",
  isPrivate: false,
  deletedAt: null,
  hlc: "2026-10-05T08:22:00.000Z-0000-node-1",
  ...over,
});

interface Meta {
  op: string;
  kind: "request" | "response";
  status: number;
}
const FAMILY_PATH = "/v1/families/{familyId}";
const META: Record<VectorName, Meta> = {
  me: { op: "GET /v1/me", kind: "response", status: 200 },
  family: { op: "POST /v1/families", kind: "response", status: 201 },
  member: { op: `GET ${FAMILY_PATH}/members`, kind: "response", status: 200 },
  account: { op: `POST ${FAMILY_PATH}/accounts`, kind: "response", status: 201 },
  category: { op: `POST ${FAMILY_PATH}/categories`, kind: "response", status: 201 },
  transaction: { op: `POST ${FAMILY_PATH}/transactions`, kind: "response", status: 201 },
  "transaction-list": { op: `GET ${FAMILY_PATH}/transactions`, kind: "response", status: 200 },
  draft: { op: `POST ${FAMILY_PATH}/ai/parse`, kind: "response", status: 200 },
  "parse-response": { op: `POST ${FAMILY_PATH}/ai/parse`, kind: "response", status: 200 },
  "summary-month": { op: `GET ${FAMILY_PATH}/reports/summary`, kind: "response", status: 200 },
  "monthly-ai-summary": { op: `GET ${FAMILY_PATH}/ai/summary`, kind: "response", status: 200 },
  "budget-list": { op: `GET ${FAMILY_PATH}/budgets`, kind: "response", status: 200 },
  "sync-request": { op: `POST ${FAMILY_PATH}/sync`, kind: "request", status: 200 },
  "sync-response": { op: `POST ${FAMILY_PATH}/sync`, kind: "response", status: 200 },
  error: { op: `PATCH ${FAMILY_PATH}/transactions/{txnId}`, kind: "response", status: 404 },
  errors: { op: "POST /v1/auth/otp/verify", kind: "response", status: 401 },
};

const BODIES: Record<VectorName, unknown> = {
  me: {
    user: {
      id: RAHIM,
      phone: "+8801700000001",
      name: "রহিম",
      locale: "bn",
      bnDigits: true,
      createdAt: T0,
      updatedAt: T0,
    },
    families: [{ id: FAMILY, name: "রহিম পরিবার", role: "owner" }],
  },
  family: {
    id: FAMILY,
    name: "রহিম পরিবার",
    currency: "BDT",
    plan: "free",
    aiQuotaMonth: 100,
    createdBy: RAHIM,
    createdAt: T0,
    updatedAt: T0,
  },
  member: [
    { userId: RAHIM, role: "owner", name: "রহিম", phone: "+8801700000001" },
    { userId: KARIMA, role: "member", name: null, phone: "+8801700000002" },
  ],
  account: {
    id: ACCOUNT,
    familyId: FAMILY,
    name: "আম্মুর বিকাশ",
    type: "bkash",
    ownerUserId: KARIMA,
    openingBalancePaisa: 500000,
    archivedAt: null,
    createdAt: T0,
    updatedAt: T0,
  },
  category: {
    id: CATEGORY,
    familyId: FAMILY,
    key: "bazaar",
    kind: "expense",
    nameEn: "Bazaar & Groceries",
    nameBn: "বাজার ও মুদি",
    icon: "🛒",
    isHidden: false,
  },
  transaction: txn(TXN1),
  "transaction-list": [
    txn(TXN2, { amountPaisa: 150000, feePaisa: 500, source: "sms", trxId: "BJ51AB12CD", syncSeq: 2, note: null }),
    txn(TXN1, { aiConfidence: 0.9, source: "ai_text", counterparty: "মুদি দোকান" }),
  ],
  draft,
  "parse-response": { drafts: [draft], usedAi: false },
  "summary-month": {
    month: "2026-10",
    incomePaisa: 5000000,
    expensePaisa: 235000,
    previous: { month: "2026-09", incomePaisa: 4800000, expensePaisa: 310000 },
    byCategory: [{ categoryId: CATEGORY, name: "বাজার ও মুদি", totalPaisa: 85000 }],
    byMember: [{ id: RAHIM, name: "রহিম", totalPaisa: 235000 }],
    byAccount: [{ id: ACCOUNT, name: "আম্মুর বিকাশ", totalPaisa: 150000 }],
  },
  "monthly-ai-summary": {
    month: "2026-10",
    locale: "bn",
    text: "অক্টোবরে খরচ হয়েছে ২,৩৫০ টাকা।",
    speechText: "অক্টোবর মাসে মোট খরচ হয়েছে দুই হাজার তিনশো পঞ্চাশ টাকা।",
    usedAi: false,
  },
  "budget-list": {
    month: "2026-10",
    budgets: [
      {
        categoryId: null,
        nameEn: "Overall",
        nameBn: "মোট",
        limitPaisa: 3000000,
        spentPaisa: 235000,
        level: "ok",
        inherited: false,
      },
      {
        categoryId: CATEGORY,
        nameEn: "Bazaar & Groceries",
        nameBn: "বাজার ও মুদি",
        limitPaisa: 100000,
        spentPaisa: 85000,
        level: "warning",
        inherited: true,
      },
    ],
  },
  "sync-request": {
    nodeId: "node-1",
    cursor: null,
    changes: { transactions: [syncTxn(TXN1)] },
  },
  "sync-response": {
    cursor: "2",
    more: false,
    applied: 1,
    rejected: [{ id: TXN2, reason: "duplicate_trx_id" }],
    changes: {
      transactions: [
        syncTxn(TXN2, { amountPaisa: 150000, source: "sms", trxId: "BJ51AB12CD", hlc: `${T1}-0001-node-2` }),
        syncTxn(TXN1, { deletedAt: T1, hlc: `${T1}-0002-node-2` }),
      ],
    },
  },
  error: { error: { code: "not_found", message: "Transaction not found" } },
  // Sign-in failures the mobile client maps to messages (T-ID-04).
  errors: [
    { error: { code: "otp_invalid", message: "Invalid code", details: { attemptsLeft: 4 } } },
    { error: { code: "otp_expired", message: "Code expired" } },
    { error: { code: "otp_rate_limited", message: "Too many requests", details: { retryAfterSeconds: 42 } } },
  ],
};

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, sortKeys(x)]),
    );
  }
  return v;
}

async function render(name: VectorName): Promise<string> {
  const body = VECTOR_SCHEMAS[name].parse(BODIES[name]); // a builder that drifts from the schema fails here
  const { op, kind, status } = META[name];
  const json = JSON.stringify(sortKeys({ _operation: op, _kind: kind, _status: status, body }));
  const config = (await prettier.resolveConfig(join(outDir, `${name}.json`))) ?? {};
  return prettier.format(json, { ...config, parser: "json" });
}

async function main() {
  const check = process.argv.includes("--check");
  const names = Object.keys(VECTOR_SCHEMAS) as VectorName[];
  const stale: string[] = [];
  if (!check) mkdirSync(outDir, { recursive: true });
  for (const name of names) {
    const text = await render(name);
    const file = join(outDir, `${name}.json`);
    if (check) {
      let current = "";
      try {
        current = readFileSync(file, "utf8");
      } catch {
        /* missing counts as stale */
      }
      if (current !== text) stale.push(`${name}.json`);
    } else {
      writeFileSync(file, text);
    }
  }
  if (stale.length > 0) {
    console.error(`Contract vectors are stale: ${stale.join(", ")}. Run: pnpm exec tsx tools/gen-vectors.ts`);
    process.exit(1);
  }
  console.log(check ? `${names.length} vectors are up to date` : `wrote ${names.length} vectors to ${outDir}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
