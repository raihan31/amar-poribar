import { DEFAULT_CATEGORIES, type AccountType } from "@amar-poribar/shared";

/** Categories every new family starts with (FR-CAT-01). */
export function defaultCategoryRows(familyId: string) {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, familyId }));
}

/** The two accounts every new family starts with: shared cash, and the creator's bKash. */
export function defaultAccountRows(familyId: string, ownerUserId: string | null) {
  return [
    { familyId, name: "Cash / নগদ", type: "cash" as AccountType },
    { familyId, name: "bKash", type: "bkash" as AccountType, ownerUserId },
  ];
}
