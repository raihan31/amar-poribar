export type TxnFilters = Record<string, string | number | boolean | undefined>;

/** Query-key factory; every key is a tuple so `invalidateQueries({ queryKey: qk.family(id).all })` works. */
export const qk = {
  me: () => ["me"] as const,
  family: (id: string) => ({
    all: ["family", id] as const,
    summary: (month?: string) => ["family", id, "summary", month ?? null] as const,
    transactions: (filters: TxnFilters = {}) => ["family", id, "transactions", filters] as const,
    budgets: (month?: string) => ["family", id, "budgets", month ?? null] as const,
    accounts: () => ["family", id, "accounts"] as const,
    categories: () => ["family", id, "categories"] as const,
    members: () => ["family", id, "members"] as const,
    conversations: () => ["family", id, "conversations"] as const,
    messages: (cid: string) => ["family", id, "conversations", cid, "messages"] as const,
    inbox: () => ["family", id, "inbox"] as const,
    presence: () => ["family", id, "presence"] as const,
    shopping: () => ["family", id, "shopping"] as const,
  }),
};
