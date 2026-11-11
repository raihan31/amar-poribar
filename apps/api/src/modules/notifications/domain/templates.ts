import { amountInWords, formatBDT, latinToBnDigits } from "@amar-poribar/shared";
import type { InboxKind } from "@amar-poribar/shared";

export type Locale = "bn" | "en";
export type NumeralStyle = "bn" | "latin";
export type TemplateParams = Record<string, string | number | undefined>;
export type Rendered = { title: string; body: string; speech: string };

const MESSAGE_PREVIEW_MAX = 80;

type Ctx = {
  locale: Locale;
  /** Amount for display (screen). */
  money: (paisa: number) => string;
  /** Amount for speech. */
  words: (paisa: number) => string;
  /** Integer for display. */
  num: (n: number) => string;
  s: (key: string) => string;
  n: (key: string) => number;
};

type Template = (c: Ctx) => Rendered;

const preview = (text: string): string => Array.from(text).slice(0, MESSAGE_PREVIEW_MAX).join("");

const BN: Record<InboxKind, Template> = {
  budget_threshold: (c) => {
    const cat = c.s("category");
    if (c.n("threshold") >= 100) {
      return {
        title: "বাজেট শেষ",
        body: `${cat}-এর বাজেট শেষ। ${c.money(c.n("over"))} বেশি খরচ হয়েছে।`,
        speech: `${cat}-এর বাজেট শেষ। ${c.words(c.n("over"))} বেশি খরচ হয়েছে।`,
      };
    }
    return {
      title: "বাজেট ৮০% শেষ",
      body: `${cat}-এর বাজেটের ৮০% খরচ হয়ে গেছে।`,
      speech: `${cat}-এর বাজেটের আশি শতাংশ খরচ হয়ে গেছে।`,
    };
  },
  invite: (c) => {
    const text = `${c.s("inviter")} আপনাকে ${c.s("family")}-এ ডেকেছেন।`;
    return { title: "পরিবারে আমন্ত্রণ", body: text, speech: text };
  },
  daily_reminder: () => {
    const text = "দিন শেষ হয়ে এল। আজকের খরচ লিখে রাখুন।";
    return { title: "আজকের খরচ লিখেছেন?", body: text, speech: text };
  },
  bill_due: (c) => {
    const name = c.s("name");
    const days = c.n("days");
    const when = days <= 0 ? "আজ" : `${c.num(days)} দিন পর`;
    const whenSpeech = days <= 0 ? "আজ" : `${numberWord(days)} দিন পর`;
    return {
      title: "বিল দেওয়ার সময়",
      body: `${name} ${when}। ${c.money(c.n("amount"))}।`,
      speech: `${name} ${whenSpeech}। ${c.words(c.n("amount"))}।`,
    };
  },
  nudge: (c) => ({
    title: c.s("sender"),
    body: c.s("phrase"),
    speech: `${c.s("sender")} বলছেন: ${c.s("phrase")}`,
  }),
  message: (c) => {
    const media = c.s("media");
    const body = media === "voice" ? "ভয়েস মেসেজ" : media === "video" ? "ভিডিও মেসেজ" : preview(c.s("text"));
    return { title: c.s("sender"), body, speech: `${c.s("sender")} বলছেন: ${body}` };
  },
  call_missed: (c) => {
    const text = `${c.s("sender")} আপনাকে ভিডিও কল করেছিলেন।`;
    return { title: "মিস কল", body: text, speech: text };
  },
  call_incoming: (c) => {
    const text = `${c.s("sender")} আপনাকে ভিডিও কল করছেন।`;
    return { title: "ভিডিও কল", body: text, speech: text };
  },
  dhar_due: (c) => ({
    title: "ধারের তাগাদা",
    body: `${c.s("name")}-এর ধার ${c.money(c.n("amount"))} ফেরত দেওয়ার সময় হয়েছে।`,
    speech: `${c.s("name")}-এর ধার ${c.words(c.n("amount"))} ফেরত দেওয়ার সময় হয়েছে।`,
  }),
  export_ready: () => {
    const text = "আপনার ডেটা এক্সপোর্ট তৈরি হয়েছে। ডাউনলোড করুন।";
    return { title: "এক্সপোর্ট তৈরি", body: text, speech: text };
  },
  erasure_scheduled: (c) => {
    const text = `আপনার অ্যাকাউন্ট মুছে ফেলা হবে ${c.s("date")} তারিখে। ফিরিয়ে আনতে চাইলে অ্যাপ খুলুন।`;
    return { title: "অ্যাকাউন্ট মোছার সময়সূচি", body: text, speech: text };
  },
  plan_changed: (c) => {
    const text = `আপনার পরিবারের প্ল্যান এখন ${c.s("plan")}।`;
    return { title: "প্ল্যান বদলেছে", body: text, speech: text };
  },
  system: (c) => ({
    title: c.s("title") || "আমার পরিবার",
    body: c.s("message"),
    speech: c.s("message"),
  }),
};

const EN: Record<InboxKind, Template> = {
  budget_threshold: (c) => {
    const cat = c.s("category");
    if (c.n("threshold") >= 100) {
      return {
        title: "Budget used up",
        body: `The ${cat} budget is used up. ${c.money(c.n("over"))} over.`,
        speech: `The ${cat} budget is used up. ${c.words(c.n("over"))} over.`,
      };
    }
    return {
      title: "Budget 80% used",
      body: `80% of the ${cat} budget is spent.`,
      speech: `Eighty percent of the ${cat} budget is spent.`,
    };
  },
  invite: (c) => {
    const text = `${c.s("inviter")} invited you to ${c.s("family")}.`;
    return { title: "Family invitation", body: text, speech: text };
  },
  daily_reminder: () => {
    const text = "The day is ending. Remember to log today's spending.";
    return { title: "Logged today's spending?", body: text, speech: text };
  },
  bill_due: (c) => {
    const days = c.n("days");
    const when = days <= 0 ? "today" : `in ${days} ${days === 1 ? "day" : "days"}`;
    return {
      title: "Bill due",
      body: `${c.s("name")} due ${when}. ${c.money(c.n("amount"))}.`,
      speech: `${c.s("name")} due ${when}. ${c.words(c.n("amount"))}.`,
    };
  },
  nudge: (c) => ({
    title: c.s("sender"),
    body: c.s("phrase"),
    speech: `${c.s("sender")} says: ${c.s("phrase")}`,
  }),
  message: (c) => {
    const media = c.s("media");
    const body = media === "voice" ? "Voice message" : media === "video" ? "Video message" : preview(c.s("text"));
    return { title: c.s("sender"), body, speech: `${c.s("sender")} says: ${body}` };
  },
  call_missed: (c) => {
    const text = `${c.s("sender")} tried to video call you.`;
    return { title: "Missed call", body: text, speech: text };
  },
  call_incoming: (c) => {
    const text = `${c.s("sender")} is video calling you.`;
    return { title: "Video call", body: text, speech: text };
  },
  dhar_due: (c) => ({
    title: "Loan reminder",
    body: `The ${c.money(c.n("amount"))} loan with ${c.s("name")} is due.`,
    speech: `The ${c.words(c.n("amount"))} loan with ${c.s("name")} is due.`,
  }),
  export_ready: () => {
    const text = "Your data export is ready. Download it now.";
    return { title: "Export ready", body: text, speech: text };
  },
  erasure_scheduled: (c) => {
    const text = `Your account will be deleted on ${c.s("date")}. Open the app to cancel.`;
    return { title: "Account deletion scheduled", body: text, speech: text };
  },
  plan_changed: (c) => {
    const text = `Your family plan is now ${c.s("plan")}.`;
    return { title: "Plan changed", body: text, speech: text };
  },
  system: (c) => ({
    title: c.s("title") || "Amar Poribar",
    body: c.s("message"),
    speech: c.s("message"),
  }),
};

const BN_ONES = ["শূন্য", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়", "দশ"];
function numberWord(n: number): string {
  return BN_ONES[n] ?? latinToBnDigits(String(n));
}

const TEMPLATES: Record<Locale, Record<InboxKind, Template>> = { bn: BN, en: EN };

/** Template keys per locale; a test asserts they match each other and INBOX_KINDS. */
export const TEMPLATE_KEYS: Record<Locale, InboxKind[]> = {
  bn: Object.keys(BN) as InboxKind[],
  en: Object.keys(EN) as InboxKind[],
};

/**
 * Render title, body and speakable text for a notification.
 * Amount params are integer paisa. `numeralStyle` only affects Bangla screen text;
 * English always uses Latin digits, and English speech uses plain digits.
 */
export function render(
  kind: InboxKind,
  locale: Locale,
  params: TemplateParams,
  opts: { numeralStyle?: NumeralStyle } = {},
): Rendered {
  const bnDigits = locale === "bn" && (opts.numeralStyle ?? "bn") === "bn";
  const ctx: Ctx = {
    locale,
    money: (paisa) => formatBDT(paisa, { bnDigits }),
    words: (paisa) => amountInWords(paisa, locale),
    num: (n) => (bnDigits ? latinToBnDigits(String(n)) : String(n)),
    s: (key) => {
      const v = params[key];
      return v === undefined ? "" : String(v);
    },
    n: (key) => {
      const v = Number(params[key] ?? 0);
      return Number.isFinite(v) ? Math.trunc(v) : 0;
    },
  };
  return TEMPLATES[locale][kind](ctx);
}

/** Realistic parameters per kind, used by tests and previews. */
export function sampleParams(kind: InboxKind): TemplateParams {
  switch (kind) {
    case "budget_threshold":
      return { category: "বাজার", threshold: 100, over: 12500000 };
    case "invite":
      return { inviter: "রহিম", family: "রহিম পরিবার" };
    case "bill_due":
      return { name: "বিদ্যুৎ বিল", days: 3, amount: 150000 };
    case "nudge":
      return { sender: "আম্মু", phrase: "ভাত খেয়েছ?" };
    case "message":
      return { sender: "আব্বু", text: "ঠিক আছে, বাজার করে ফিরছি।" };
    case "call_missed":
    case "call_incoming":
      return { sender: "আব্বু" };
    case "dhar_due":
      return { name: "করিম", amount: 500000 };
    case "erasure_scheduled":
      return { date: "১৫ ডিসেম্বর" };
    case "plan_changed":
      return { plan: "ফ্যামিলি প্লাস" };
    case "system":
      return { title: "আমার পরিবার", message: "নতুন সংস্করণ পাওয়া যাচ্ছে।" };
    default:
      return {};
  }
}
