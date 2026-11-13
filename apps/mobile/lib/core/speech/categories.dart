/// Default categories with Bangla names and icons. Mirrors packages/shared/src/categories.ts.
class DefaultCategory {
  final String key;
  final String kind;
  final String nameBn;
  final String icon;
  const DefaultCategory(this.key, this.kind, this.nameBn, this.icon);
}

const List<DefaultCategory> kDefaultCategories = [
  DefaultCategory('bazaar', 'expense', 'বাজার ও মুদি', '🛒'),
  DefaultCategory('rent', 'expense', 'বাসা ভাড়া', '🏠'),
  DefaultCategory('electricity', 'expense', 'বিদ্যুৎ বিল', '💡'),
  DefaultCategory('gas', 'expense', 'গ্যাস বিল', '🔥'),
  DefaultCategory('water', 'expense', 'পানির বিল', '🚰'),
  DefaultCategory('internet', 'expense', 'ইন্টারনেট ও ডিশ', '📶'),
  DefaultCategory('mobile_recharge', 'expense', 'মোবাইল রিচার্জ', '📱'),
  DefaultCategory('transport', 'expense', 'যাতায়াত', '🛺'),
  DefaultCategory('education', 'expense', 'শিক্ষা', '📚'),
  DefaultCategory('medical', 'expense', 'চিকিৎসা', '💊'),
  DefaultCategory('domestic_help', 'expense', 'গৃহকর্মী', '🧹'),
  DefaultCategory('clothing', 'expense', 'পোশাক', '👕'),
  DefaultCategory('eating_out', 'expense', 'বাইরে খাওয়া', '🍛'),
  DefaultCategory('family_support', 'expense', 'আত্মীয়দের সহায়তা', '🤝'),
  DefaultCategory('charity', 'expense', 'যাকাত ও দান', '🕌'),
  DefaultCategory('festival', 'expense', 'উৎসব (ঈদ/পূজা)', '🎉'),
  DefaultCategory('gifts', 'expense', 'উপহার ও দাওয়াত', '🎁'),
  DefaultCategory('household', 'expense', 'গৃহস্থালি', '🧺'),
  DefaultCategory('personal_care', 'expense', 'ব্যক্তিগত যত্ন', '🧴'),
  DefaultCategory('entertainment', 'expense', 'বিনোদন', '🎬'),
  DefaultCategory('loan_emi', 'expense', 'ঋণ / কিস্তি', '🏦'),
  DefaultCategory('fees', 'expense', 'ফি ও চার্জ', '🧾'),
  DefaultCategory('other_expense', 'expense', 'অন্যান্য', '📦'),
  DefaultCategory('salary', 'income', 'বেতন', '💼'),
  DefaultCategory('business', 'income', 'ব্যবসা', '🏪'),
  DefaultCategory('remittance', 'income', 'রেমিট্যান্স', '✈️'),
  DefaultCategory('rent_received', 'income', 'ভাড়া আয়', '🏘️'),
  DefaultCategory('other_income', 'income', 'অন্যান্য আয়', '💰'),
];

/// Words a person says for a category, used by the offline quick parser (FR-AI-13).
/// A spoken word matches when it starts with a keyword ("বাজারে" matches "বাজার"); a keyword
/// with a space must match that many words in a row.
const Map<String, List<String>> kCategoryKeywords = {
  'bazaar': ['বাজার', 'মুদি', 'সবজি', 'মাছ', 'মাংস'],
  'rent': ['বাসাভাড়া', 'বাসা ভাড়া', 'বাড়ি ভাড়া', 'বাড়ীভাড়া'],
  'electricity': ['বিদ্যুৎ', 'কারেন্ট', 'বিজলি'],
  'gas': ['গ্যাস'],
  'water': ['পানির'],
  'internet': ['ইন্টারনেট', 'ওয়াইফাই', 'ডিশ'],
  'mobile_recharge': ['রিচার্জ'],
  'transport': ['রিকশা', 'সিএনজি', 'যাতায়াত', 'উবার', 'ট্রেন'],
  'education': ['স্কুল', 'টিউশন', 'কোচিং', 'শিক্ষা', 'পড়ালেখা'],
  'medical': ['ওষুধ', 'ঔষধ', 'ডাক্তার', 'চিকিৎসা', 'হাসপাতাল'],
  'domestic_help': ['বুয়া', 'গৃহকর্মী'],
  'clothing': ['কাপড়', 'জামা', 'পোশাক', 'শাড়ি'],
  'eating_out': ['রেস্টুরেন্ট', 'বিরিয়ানি'],
  'charity': ['দান', 'যাকাত', 'সদকা', 'ফিতরা'],
  'festival': ['ঈদ', 'পূজা', 'উৎসব'],
  'gifts': ['উপহার', 'দাওয়াত'],
  'salary': ['বেতন'],
  'remittance': ['রেমিট্যান্স'],
};

DefaultCategory? categoryByKey(String? key) {
  for (final c in kDefaultCategories) {
    if (c.key == key) return c;
  }
  return null;
}
