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
  netSaving: { bn: "সঞ্চয় (আয় − খরচ)", en: "Net (income − spent)" },
  vsLastMonth: { bn: "গত মাসের তুলনায়", en: "vs last month" },
  more: { bn: "বেশি", en: "more" },
  less: { bn: "কম", en: "less" },
  byCategory: { bn: "ক্যাটাগরি", en: "Category" },
  byMember: { bn: "সদস্য", en: "Member" },
  byAccount: { bn: "অ্যাকাউন্ট", en: "Account" },
  prevMonth: { bn: "আগের মাস", en: "Previous month" },
  nextMonth: { bn: "পরের মাস", en: "Next month" },
  noData: { bn: "এই মাসে কোনো খরচ নেই", en: "No spending this month" },
  budgets: { bn: "বাজেট", en: "Budgets" },
  budgetOverall: { bn: "মোট বাজেট", en: "Overall budget" },
  budgetSet: { bn: "বাজেট ঠিক করুন", en: "Set budget" },
  budgetSave: { bn: "সংরক্ষণ", en: "Save" },
  budgetNone: { bn: "কোনো বাজেট নেই", en: "No budget" },
  budgetWarning: { bn: "প্রায় শেষ", en: "Nearly used" },
  budgetExceeded: { bn: "সীমা ছাড়িয়েছে", en: "Over budget" },
  budgetCarried: { bn: "গত মাস থেকে", en: "carried over" },
  speak: { bn: "শুনুন", en: "Listen" },
  stop: { bn: "থামুন", en: "Stop" },
  tapToSpeak: { bn: "চাপ দিয়ে বলুন", en: "Tap and speak" },
  listening: { bn: "শুনছি…", en: "Listening…" },
  monthlySummary: { bn: "মাসের হিসাব", en: "Monthly summary" },
  yes: { bn: "হ্যাঁ, ঠিক আছে", en: "Yes, save it" },
  no: { bn: "না", en: "No" },
  voiceUnsupported: { bn: "এই ব্রাউজারে ভয়েস চলে না", en: "Voice input isn't supported in this browser" },
  noDrafts: { bn: "কিছু বোঝা যায়নি, হাতে লিখে দিন", en: "Couldn't understand that; please enter it manually" },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, locale: Locale = "bn"): string {
  return strings[key][locale];
}
