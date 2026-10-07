export type CategoryKind = "expense" | "income";

export interface DefaultCategory {
  /** Stable key, used for seeding and for AI prompts. */
  key: string;
  kind: CategoryKind;
  nameEn: string;
  nameBn: string;
  icon: string;
}

/** Default categories tuned for Bangladeshi household spending (SRS FR-CAT-01, FR-CAT-03). */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { key: "bazaar", kind: "expense", nameEn: "Bazaar & Groceries", nameBn: "বাজার ও মুদি", icon: "🛒" },
  { key: "rent", kind: "expense", nameEn: "House Rent", nameBn: "বাসা ভাড়া", icon: "🏠" },
  { key: "electricity", kind: "expense", nameEn: "Electricity", nameBn: "বিদ্যুৎ বিল", icon: "💡" },
  { key: "gas", kind: "expense", nameEn: "Gas", nameBn: "গ্যাস বিল", icon: "🔥" },
  { key: "water", kind: "expense", nameEn: "Water", nameBn: "পানির বিল", icon: "🚰" },
  { key: "internet", kind: "expense", nameEn: "Internet & TV", nameBn: "ইন্টারনেট ও ডিশ", icon: "📶" },
  { key: "mobile_recharge", kind: "expense", nameEn: "Mobile Recharge", nameBn: "মোবাইল রিচার্জ", icon: "📱" },
  { key: "transport", kind: "expense", nameEn: "Transport", nameBn: "যাতায়াত", icon: "🛺" },
  { key: "education", kind: "expense", nameEn: "Education", nameBn: "শিক্ষা", icon: "📚" },
  { key: "medical", kind: "expense", nameEn: "Medical", nameBn: "চিকিৎসা", icon: "💊" },
  { key: "domestic_help", kind: "expense", nameEn: "Domestic Help", nameBn: "গৃহকর্মী", icon: "🧹" },
  { key: "clothing", kind: "expense", nameEn: "Clothing", nameBn: "পোশাক", icon: "👕" },
  { key: "eating_out", kind: "expense", nameEn: "Eating Out", nameBn: "বাইরে খাওয়া", icon: "🍛" },
  { key: "family_support", kind: "expense", nameEn: "Family Support", nameBn: "আত্মীয়দের সহায়তা", icon: "🤝" },
  { key: "charity", kind: "expense", nameEn: "Zakat & Charity", nameBn: "যাকাত ও দান", icon: "🕌" },
  { key: "festival", kind: "expense", nameEn: "Festival (Eid/Puja)", nameBn: "উৎসব (ঈদ/পূজা)", icon: "🎉" },
  { key: "gifts", kind: "expense", nameEn: "Gifts & Dawat", nameBn: "উপহার ও দাওয়াত", icon: "🎁" },
  { key: "household", kind: "expense", nameEn: "Household Items", nameBn: "গৃহস্থালি", icon: "🧺" },
  { key: "personal_care", kind: "expense", nameEn: "Personal Care", nameBn: "ব্যক্তিগত যত্ন", icon: "🧴" },
  { key: "entertainment", kind: "expense", nameEn: "Entertainment", nameBn: "বিনোদন", icon: "🎬" },
  { key: "loan_emi", kind: "expense", nameEn: "Loan / EMI", nameBn: "ঋণ / কিস্তি", icon: "🏦" },
  { key: "fees", kind: "expense", nameEn: "Fees & Charges", nameBn: "ফি ও চার্জ", icon: "🧾" },
  { key: "other_expense", kind: "expense", nameEn: "Other", nameBn: "অন্যান্য", icon: "📦" },
  { key: "salary", kind: "income", nameEn: "Salary", nameBn: "বেতন", icon: "💼" },
  { key: "business", kind: "income", nameEn: "Business", nameBn: "ব্যবসা", icon: "🏪" },
  { key: "remittance", kind: "income", nameEn: "Remittance Received", nameBn: "রেমিট্যান্স", icon: "✈️" },
  { key: "rent_received", kind: "income", nameEn: "Rent Received", nameBn: "ভাড়া আয়", icon: "🏘️" },
  { key: "other_income", kind: "income", nameEn: "Other Income", nameBn: "অন্যান্য আয়", icon: "💰" },
] as const;
