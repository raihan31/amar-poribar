/** Web-only strings (bn is the source of key truth). Keys shared with the API live in packages/shared. */
export const webBn = {
  "login.prompt": "মোবাইল নম্বর দিয়ে লগইন করুন",
  "login.codePlaceholder": "৬ সংখ্যার কোড",
  "login.submit": "লগইন",
  "family.createPrompt": "আপনার পরিবারের নাম দিন",
  "family.namePlaceholder": "যেমন: রহমান পরিবার",
  "family.create": "তৈরি করুন",
  "common.loading": "লোড হচ্ছে…",
  "common.logout": "লগআউট",
  "category.label": "ক্যাটাগরি",
  "category.pick": "ক্যাটাগরি বাছাই করুন",
  "relative.now": "এইমাত্র",
} as const;

export type WebKey = keyof typeof webBn;

export const webEn: Record<WebKey, string> = {
  "login.prompt": "Log in with your mobile number",
  "login.codePlaceholder": "6-digit code",
  "login.submit": "Log in",
  "family.createPrompt": "Give your family a name",
  "family.namePlaceholder": "e.g. Rahman family",
  "family.create": "Create",
  "common.loading": "Loading…",
  "common.logout": "Log out",
  "category.label": "Category",
  "category.pick": "Choose a category",
  "relative.now": "just now",
};
