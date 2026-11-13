"use client";

import { amountInWords, draftToSpeech, type TransactionDraft } from "@amar-poribar/shared";
import { useFormat } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useT, type TKey } from "@/lib/i18n/useT";
import type { Category } from "@/lib/types";
import { dayWord } from "./quickParse";

const TYPE_KEY: Record<TransactionDraft["type"], TKey> = {
  expense: "entry.type.expense",
  income: "entry.type.income",
  transfer: "entry.type.transfer",
};

const ACCOUNT_KEY: Record<string, TKey> = {
  cash: "entry.acct.cash",
  bkash: "entry.acct.bkash",
  nagad: "entry.acct.nagad",
  rocket: "entry.acct.rocket",
  upay: "entry.acct.upay",
  bank: "entry.acct.bank",
  card: "entry.acct.card",
  other: "entry.acct.other",
};

/** Words and sentences for one draft, in the user's language. */
export function useDraftLabels() {
  const t = useT();
  const { locale } = useI18n();
  const { money, name, date } = useFormat();

  const accountWord = (d: TransactionDraft) =>
    d.accountType ? t(ACCOUNT_KEY[d.accountType] ?? "entry.acct.other") : null;
  const dayLabel = (d: TransactionDraft) => {
    const w = dayWord(d.occurredAt);
    return w === "today" ? t("entry.today") : w === "yesterday" ? t("entry.yesterday") : date(d.occurredAt);
  };

  return {
    amount: (d: TransactionDraft) => money(d.amountPaisa),
    words: (d: TransactionDraft) => amountInWords(d.amountPaisa, locale),
    /** "খরচ · ক্যাশ · আজ" */
    meta: (d: TransactionDraft) => [t(TYPE_KEY[d.type]), accountWord(d), dayLabel(d)].filter(Boolean).join(" · "),
    /** Same without the type word, for the A4 header: "ক্যাশ · আজ". */
    metaShort: (d: TransactionDraft) => [accountWord(d), dayLabel(d)].filter(Boolean).join(" · "),
    sentence: (d: TransactionDraft, category: Category | null) =>
      draftToSpeech(d, category ? name(category) : null, locale),
  };
}
