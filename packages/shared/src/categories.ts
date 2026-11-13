import type { CategoryIconId } from "./icons.js";

export type CategoryKind = "expense" | "income";

export interface DefaultCategory {
  /** Stable key, used for seeding and for AI prompts. */
  key: string;
  kind: CategoryKind;
  nameEn: string;
  nameBn: string;
  icon: CategoryIconId;
}

/** Default categories tuned for Bangladeshi household spending (SRS FR-CAT-01, FR-CAT-03). */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { key: "bazaar", kind: "expense", nameEn: "Bazaar & Groceries", nameBn: "বাজার ও মুদি", icon: "bag" },
  { key: "rent", kind: "expense", nameEn: "House Rent", nameBn: "বাসা ভাড়া", icon: "home" },
  { key: "electricity", kind: "expense", nameEn: "Electricity", nameBn: "বিদ্যুৎ বিল", icon: "bolt" },
  { key: "gas", kind: "expense", nameEn: "Gas", nameBn: "গ্যাস বিল", icon: "flame" },
  { key: "water", kind: "expense", nameEn: "Water", nameBn: "পানির বিল", icon: "drop" },
  { key: "internet", kind: "expense", nameEn: "Internet & TV", nameBn: "ইন্টারনেট ও ডিশ", icon: "wifi" },
  { key: "mobile_recharge", kind: "expense", nameEn: "Mobile Recharge", nameBn: "মোবাইল রিচার্জ", icon: "phone" },
  { key: "transport", kind: "expense", nameEn: "Transport", nameBn: "যাতায়াত", icon: "ride" },
  { key: "education", kind: "expense", nameEn: "Education", nameBn: "শিক্ষা", icon: "school" },
  { key: "medical", kind: "expense", nameEn: "Medical", nameBn: "চিকিৎসা", icon: "pulse" },
  { key: "domestic_help", kind: "expense", nameEn: "Domestic Help", nameBn: "গৃহকর্মী", icon: "helper" },
  { key: "clothing", kind: "expense", nameEn: "Clothing", nameBn: "পোশাক", icon: "shirt" },
  { key: "eating_out", kind: "expense", nameEn: "Eating Out", nameBn: "বাইরে খাওয়া", icon: "plate" },
  { key: "family_support", kind: "expense", nameEn: "Family Support", nameBn: "আত্মীয়দের সহায়তা", icon: "hands" },
  { key: "charity", kind: "expense", nameEn: "Zakat & Charity", nameBn: "যাকাত ও দান", icon: "heart" },
  { key: "festival", kind: "expense", nameEn: "Festival (Eid/Puja)", nameBn: "উৎসব (ঈদ/পূজা)", icon: "gift" },
  { key: "gifts", kind: "expense", nameEn: "Gifts & Dawat", nameBn: "উপহার ও দাওয়াত", icon: "gift" },
  { key: "household", kind: "expense", nameEn: "Household Items", nameBn: "গৃহস্থালি", icon: "basket" },
  { key: "personal_care", kind: "expense", nameEn: "Personal Care", nameBn: "ব্যক্তিগত যত্ন", icon: "comb" },
  { key: "entertainment", kind: "expense", nameEn: "Entertainment", nameBn: "বিনোদন", icon: "film" },
  { key: "loan_emi", kind: "expense", nameEn: "Loan / EMI", nameBn: "ঋণ / কিস্তি", icon: "bank" },
  { key: "fees", kind: "expense", nameEn: "Fees & Charges", nameBn: "ফি ও চার্জ", icon: "receipt" },
  { key: "other_expense", kind: "expense", nameEn: "Other", nameBn: "অন্যান্য", icon: "box" },
  { key: "salary", kind: "income", nameEn: "Salary", nameBn: "বেতন", icon: "wallet" },
  { key: "business", kind: "income", nameEn: "Business", nameBn: "ব্যবসা", icon: "shop" },
  { key: "remittance", kind: "income", nameEn: "Remittance Received", nameBn: "রেমিট্যান্স", icon: "plane" },
  { key: "rent_received", kind: "income", nameEn: "Rent Received", nameBn: "ভাড়া আয়", icon: "key" },
  { key: "other_income", kind: "income", nameEn: "Other Income", nameBn: "অন্যান্য আয়", icon: "wallet" },
] as const;
