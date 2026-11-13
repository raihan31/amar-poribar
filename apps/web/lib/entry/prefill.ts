import type { TransactionDraft } from "@amar-poribar/shared";
import type { Account, Category } from "@/lib/types";
import { dayWord } from "./quickParse";
import type { TransactionFormValues } from "./transactionSchema";

const dhakaDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(iso));

/** Form defaults from `?draft=` (A3 "বদলাতে চাই") and `?category=`; bad input is ignored. */
export function prefillFromSearch(
  search: string,
  categories: Category[],
  accounts: Account[],
  meId?: string,
): TransactionFormValues {
  const params = new URLSearchParams(search);
  let draft: TransactionDraft | null = null;
  try {
    const raw = params.get("draft");
    if (raw) draft = JSON.parse(raw) as TransactionDraft;
  } catch {
    draft = null;
  }
  const catKey = draft?.categoryKey ?? params.get("category");
  const day = draft ? dayWord(draft.occurredAt) : "today";
  const taka = draft && Number.isInteger(draft.amountPaisa) ? draft.amountPaisa / 100 : 0;
  return {
    type: draft?.type ?? "expense",
    amount: taka > 0 ? String(taka) : "",
    categoryId: categories.find((c) => c.key === catKey)?.id ?? null,
    accountId: (draft?.accountType ? accounts.find((a) => a.type === draft.accountType) : accounts[0])?.id ?? null,
    paidByUserId: meId,
    day: day ?? "other",
    date: draft && day === null ? dhakaDate(draft.occurredAt) : "",
    note: draft?.note ?? "",
    fee: draft && draft.feePaisa > 0 ? String(draft.feePaisa / 100) : "",
    isPrivate: false,
  };
}
