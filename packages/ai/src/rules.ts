import {
  bnToLatinDigits,
  parseBanglaNumberWords,
  takaToPaisa,
  type AccountType,
  type TransactionDraft,
} from "@amar-poribar/shared";

/**
 * Offline parser for short, simple entries such as "আজ বাজারে আটশো পঞ্চাশ টাকা" or "rickshaw 40".
 * It needs no AI, so it works without network and costs nothing (BO-6). Voice entries from
 * low-literacy users are usually this simple (SRS FR-VOICE-02).
 */

// Keyword → category key. Bangla script, Banglish and English, most specific first.
const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/রিচার্জ|recharge|ফ্লেক্সি|flexi/i, "mobile_recharge"],
  [/বিদ্যুৎ|কারেন্ট|current bill|electric|desco|dpdc|nesco|পল্লী বিদ্যুৎ/i, "electricity"],
  [/গ্যাস|gas|titas|তিতাস/i, "gas"],
  [/পানির বিল|ওয়াসা|wasa|water bill/i, "water"],
  [/ইন্টারনেট|ওয়াইফাই|wifi|internet|ডিশ|dish|ক্যাবল/i, "internet"],
  [/বাসা ভাড়া|ঘর ভাড়া|বাড়ি ভাড়া|house rent|basa vara|basha vara|\brent\b/i, "rent"],
  [/রিকশা|রিক্সা|সিএনজি|বাস ভাড়া|বাসে|উবার|পাঠাও|ট্রেন|লঞ্চ|rickshaw|riksha|cng|uber|pathao|bus|train|fare|ভাড়া/i, "transport"],
  [/বাজার|সবজি|মাছ|মাংস|চাল|ডাল|তেল|ডিম|মুদি|bazar|bazaar|grocer|vegetable|fish|rice|shwapno|স্বপ্ন/i, "bazaar"],
  [/ওষুধ|ঔষধ|ডাক্তার|হাসপাতাল|ক্লিনিক|টেস্ট|medicine|doctor|hospital|clinic|pharmacy|osudh/i, "medical"],
  [/স্কুল|কলেজ|বেতন দিলাম স্কুলে|প্রাইভেট|কোচিং|টিউশন|বই|খাতা|school|college|coaching|tuition|book/i, "education"],
  [/বুয়া|কাজের লোক|গৃহকর্মী|maid|bua/i, "domestic_help"],
  [/জামা|কাপড়|শাড়ি|লুঙ্গি|জুতা|clothes|shirt|saree|shoe/i, "clothing"],
  [/রেস্টুরেন্ট|হোটেলে খাওয়া|চা|নাস্তা|restaurant|tea|snacks|cha\b|nasta/i, "eating_out"],
  [/যাকাত|দান|সদকা|মসজিদ|zakat|charity|donation/i, "charity"],
  [/আম্মু|আব্বু|মা কে|বাবা কে|বাড়িতে পাঠালাম|গ্রামে পাঠালাম|ammu|abbu|sent home/i, "family_support"],
];

const ACCOUNT_KEYWORDS: [RegExp, AccountType][] = [
  [/বিকাশ|bkash|bikash/i, "bkash"],
  [/\bnagad\b/i, "nagad"], // in Bangla script "নগদ" usually means cash, so only the Latin spelling maps to Nagad
  [/রকেট|rocket/i, "rocket"],
  [/উপায়|upay/i, "upay"],
  [/কার্ড|card/i, "card"],
  [/ব্যাংক|bank/i, "bank"],
  [/ক্যাশ|নগদে|নগদ টাকা|হাতে|cash/i, "cash"],
];

const INCOME_WORDS = /বেতন পেলাম|পেলাম|আয়|received|salary|got paid|পাঠিয়েছে/i;

/** Every number written with digits, e.g. "৮৫০" or "1,500". */
function digitAmounts(text: string): number[] {
  return [...bnToLatinDigits(text).replace(/(\d),(?=\d)/g, "$1").matchAll(/\d+(?:\.\d{1,2})?/g)].map((m) => Number(m[0]));
}

function dayOffset(text: string): number {
  if (/পরশু|porshu/i.test(text)) return 2;
  if (/গতকাল|কাল রাতে|gotokal|yesterday/i.test(text)) return 1;
  return 0;
}

export interface QuickParseResult {
  draft: TransactionDraft;
  /** True when both amount and category were found; the result can be used without asking the AI. */
  complete: boolean;
}

/**
 * Parse one simple entry. Returns null when there isn't exactly one amount,
 * because multi-item sentences ("বাজারে ৫০০ আর রিকশায় ৫০") need the AI.
 */
export function quickParse(text: string, now: Date = new Date()): QuickParseResult | null {
  const digits = digitAmounts(text);
  let taka: number | null = null;
  if (digits.length === 1) taka = digits[0]!;
  else if (digits.length === 0) taka = parseBanglaNumberWords(text);
  if (!taka || taka <= 0) return null;

  const categoryKey = CATEGORY_KEYWORDS.find(([re]) => re.test(text))?.[1] ?? null;
  const accountType = ACCOUNT_KEYWORDS.find(([re]) => re.test(text))?.[1] ?? null;
  const offset = dayOffset(text);
  const occurredAt = offset
    ? new Date(now.getTime() - offset * 86_400_000).toISOString()
    : now.toISOString();

  return {
    complete: categoryKey !== null,
    draft: {
      type: INCOME_WORDS.test(text) ? "income" : "expense",
      amountPaisa: takaToPaisa(taka),
      feePaisa: 0,
      occurredAt,
      categoryKey,
      accountType,
      note: text.trim().slice(0, 120),
      counterparty: null,
      trxId: null,
      source: "ai_text",
      confidence: categoryKey ? 0.8 : 0.5,
    },
  };
}
