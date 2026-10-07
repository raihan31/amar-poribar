import type { Locale } from "./i18n.js";
import type { TransactionDraft } from "./schemas.js";
import { amountInWords } from "./words.js";

/**
 * Sentence read aloud after a voice or text entry, so users who can't read
 * the screen comfortably can still check the draft before confirming (SRS FR-VOICE-03).
 */
export function draftToSpeech(draft: TransactionDraft, categoryName: string | null, locale: Locale = "bn"): string {
  const amount = amountInWords(draft.amountPaisa, locale);
  if (locale === "en") {
    const what = draft.type === "income" ? "Income" : draft.type === "transfer" ? "Transfer" : "Expense";
    if (!categoryName) return `${what} of ${amount}. What was it for? Tap a picture below.`;
    return `${what} of ${amount} for ${categoryName}. Is that right?`;
  }
  const verb = draft.type === "income" ? "আয়" : draft.type === "transfer" ? "স্থানান্তর" : "খরচ";
  if (!categoryName) return `${amount} ${verb}। কিসের জন্য? নিচের ছবিতে চাপ দিন।`;
  return `${categoryName} খাতে ${amount} ${verb}। ঠিক আছে?`;
}
