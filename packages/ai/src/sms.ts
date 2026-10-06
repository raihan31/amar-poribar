import {
  bnToLatinDigits,
  parseAmountToPaisa,
  type AccountType,
  type TransactionDraft,
  type TransactionType,
} from "@amar-poribar/shared";

/**
 * Deterministic parser for bKash / Nagad / Rocket SMS (SRS FR-AI-02).
 * Runs before any LLM call so common messages cost nothing and never leave the server.
 */

type Provider = Extract<AccountType, "bkash" | "nagad" | "rocket">;
type SmsKind = "send" | "payment" | "cash_out" | "received" | "bill" | "recharge" | "cash_in";

const AMOUNT = String.raw`(?:Tk|BDT|৳)\.?\s*([\d,]+(?:\.\d{1,2})?)`;

function detectProvider(sms: string): Provider | null {
  if (/\bnagad\b/i.test(sms) || /\bTxnID\b/.test(sms)) return "nagad";
  if (/\brocket\b|\bDBBL\b/i.test(sms) || /\bTxnId\b/.test(sms)) return "rocket";
  if (/\bTrxID\b/i.test(sms) || /\bbkash\b/i.test(sms)) return "bkash";
  return null;
}

function detectKind(sms: string): SmsKind | null {
  if (/recharge/i.test(sms)) return "recharge";
  if (/bill\s+(?:successfully\s+)?paid|bill\s+payment|biller/i.test(sms)) return "bill";
  if (/cash\s*out/i.test(sms)) return "cash_out";
  if (/cash\s*in/i.test(sms)) return "cash_in";
  if (/received|money\s+received/i.test(sms)) return "received";
  if (/payment/i.test(sms)) return "payment";
  if (/sent|send\s+money|money\s+sent/i.test(sms)) return "send";
  return null;
}

function amountAfter(label: RegExp, sms: string): number | null {
  const m = sms.match(new RegExp(label.source + String.raw`\s*:?\s*` + AMOUNT, "i"));
  return m?.[1] ? parseAmountToPaisa(m[1]) : null;
}

function firstAmount(sms: string): number | null {
  const m = sms.match(new RegExp(AMOUNT, "i"));
  return m?.[1] ? parseAmountToPaisa(m[1]) : null;
}

function extractTrxId(sms: string): string | null {
  const m = sms.match(/\b(?:TrxID|TxnID|TxnId|Trx\s*ID|Txn\s*ID)\s*:?\s*([A-Z0-9]{6,20})\b/i);
  return m?.[1] ?? null;
}

/** "05/10/2026 14:22" (dd/mm/yyyy, Asia/Dhaka) → ISO with +06:00. */
function extractDate(sms: string): string | null {
  const m = sms.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m;
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00+06:00`;
}

/** Keep only the last 3 digits of phone numbers (SRS §6.1 privacy). */
export function maskPhone(text: string): string {
  return text.replace(/(?:\+?88)?01[3-9]\d{5}(\d{3})/g, "01XXXXXX$1");
}

function extractCounterparty(sms: string, kind: SmsKind): string | null {
  const biller = sms.match(/Biller\s*:?\s*([A-Za-z][\w &.-]{1,40}?)(?=\s*(?:\.|,|Account|Acc|Amount|Bill|$))/i);
  if (biller?.[1]) return biller[1].trim();
  const labelled = sms.match(/(?:Receiver|Sender|Merchant|Agent)\s*:?\s*([+\w][\w &.()-]{2,40}?)(?=\s*(?:\.|,|Ref|Amount|TxnID|TrxID|Fee|Balance|$))/i);
  if (labelled?.[1]) return maskPhone(labelled[1].trim());
  const preposition = kind === "received" ? "from" : "to";
  const m = sms.match(new RegExp(String.raw`\b${preposition}\s+([+\w][\w &.()-]{2,40}?)(?=\s+(?:is\s+)?(?:successful|Ref|Fee|Balance|TrxID)|[.,]|$)`, "i"));
  return m?.[1] ? maskPhone(m[1].trim()) : null;
}

const BILLER_CATEGORY: [RegExp, string][] = [
  [/DESCO|DPDC|NESCO|BPDB|REB|Palli\s*Bidyut|WZPDCL|electric/i, "electricity"],
  [/Titas|Karnaphuli|Bakhrabad|Jalalabad|Paschimanchal|gas/i, "gas"],
  [/WASA|water/i, "water"],
  [/internet|broadband|Link3|Carnival|Amber|Dish|Akash/i, "internet"],
];

function categoryFor(kind: SmsKind, counterparty: string | null): string | null {
  if (kind === "recharge") return "mobile_recharge";
  if (kind === "bill" && counterparty) {
    return BILLER_CATEGORY.find(([re]) => re.test(counterparty))?.[1] ?? null;
  }
  return null;
}

const TYPE_FOR_KIND: Record<SmsKind, TransactionType> = {
  send: "expense",
  payment: "expense",
  bill: "expense",
  recharge: "expense",
  cash_out: "transfer",
  cash_in: "transfer",
  received: "income",
};

const NOTE_FOR_KIND: Record<SmsKind, string> = {
  send: "Send Money",
  payment: "Payment",
  bill: "Bill Payment",
  recharge: "Mobile Recharge",
  cash_out: "Cash Out",
  cash_in: "Cash In",
  received: "Money Received",
};

/** Returns true when the text looks like an MFS transaction SMS. */
export function looksLikeMfsSms(text: string): boolean {
  return detectProvider(text) !== null && extractTrxId(text) !== null;
}

/**
 * Parse an MFS SMS. Returns null if the text is not a recognisable MFS transaction,
 * in which case the caller should fall back to the LLM.
 */
export function parseMfsSms(raw: string, now: Date = new Date()): TransactionDraft | null {
  const sms = bnToLatinDigits(raw).replace(/\s+/g, " ").trim();
  const provider = detectProvider(sms);
  const kind = detectKind(sms);
  const trxId = extractTrxId(sms);
  if (!provider || !kind || !trxId) return null;

  const amountPaisa = amountAfter(/Amount/, sms) ?? firstAmount(sms);
  if (!amountPaisa || amountPaisa <= 0) return null;

  const counterparty = extractCounterparty(sms, kind);
  return {
    type: TYPE_FOR_KIND[kind],
    amountPaisa,
    feePaisa: amountAfter(/Fee/, sms) ?? 0,
    occurredAt: extractDate(sms) ?? now.toISOString(),
    categoryKey: categoryFor(kind, counterparty),
    accountType: provider,
    note: counterparty ? `${NOTE_FOR_KIND[kind]} — ${counterparty}` : NOTE_FOR_KIND[kind],
    counterparty,
    trxId,
    source: "sms",
    confidence: 0.99,
  };
}
