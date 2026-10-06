export type Locale = "bn" | "en";

const strings = {
  appName: { bn: "আমার পরিবার", en: "Amar Poribar" },
  quickAddPlaceholder: {
    bn: "যেমন: আজ বাজারে ৮৫০ টাকা ক্যাশে",
    en: "e.g. bazar 850 cash, or paste a bKash SMS",
  },
  parse: { bn: "বুঝে নাও", en: "Parse" },
  confirm: { bn: "নিশ্চিত করুন", en: "Confirm" },
  thisMonth: { bn: "এই মাস", en: "This month" },
  totalExpense: { bn: "মোট খরচ", en: "Total spent" },
  totalIncome: { bn: "মোট আয়", en: "Total income" },
  noDrafts: { bn: "কিছু বোঝা যায়নি, হাতে লিখে দিন", en: "Couldn't understand that; please enter it manually" },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, locale: Locale = "bn"): string {
  return strings[key][locale];
}
