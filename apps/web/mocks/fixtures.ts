import type { BudgetRow, Category, Account, Family, Member } from "@/lib/types";

/** Deterministic id: stable across runs so snapshots and e2e selectors never flake. */
export function fid(kind: string, n: number): string {
  const hex = (kind.charCodeAt(0) * 4099 + n).toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

export interface DemoTransaction {
  id: string;
  kind: "expense" | "income";
  amountPaisa: number;
  categoryId: string;
  accountId: string;
  paidByUserId: string;
  occurredAt: string;
  note: string | null;
}

export interface DemoFamily {
  family: Family;
  me: { id: string; phone: string; name: string };
  members: Member[];
  accounts: Account[];
  categories: Category[];
  budgets: BudgetRow[];
  transactions: DemoTransaction[];
}

const CATEGORIES: Array<[string, string, string]> = [
  ["bazar", "বাজার", "Groceries"],
  ["transport", "যাতায়াত", "Transport"],
  ["utilities", "বিল", "Utilities"],
  ["education", "শিক্ষা", "Education"],
  ["health", "চিকিৎসা", "Health"],
  ["rent", "বাড়িভাড়া", "Rent"],
];

/** The design's demo family "রহিম পরিবার": 5 members, 120 transactions, budgets, accounts, categories. */
export function demoFamily(): DemoFamily {
  const family: Family = { id: fid("f", 1), name: "রহিম পরিবার", role: "owner" };
  const names = ["আব্বু", "আম্মু", "দাদা", "দাদি", "তানভীর"];
  const roles = ["owner", "admin", "member", "member", "viewer"] as const;
  const members: Member[] = names.map((name, i) => ({
    userId: fid("u", i + 1),
    role: roles[i]!,
    name,
    phone: `+88017000000${String(i + 1).padStart(2, "0")}`,
  }));
  const categories: Category[] = CATEGORIES.map(([key, nameBn, nameEn], i) => ({
    id: fid("c", i + 1),
    key,
    kind: "expense",
    nameBn,
    nameEn,
    icon: null,
  }));
  const accounts: Account[] = [
    { id: fid("a", 1), name: "নগদ", type: "cash" },
    { id: fid("a", 2), name: "বিকাশ", type: "mfs" },
    { id: fid("a", 3), name: "ব্যাংক", type: "bank" },
  ];
  const transactions: DemoTransaction[] = Array.from({ length: 120 }, (_, i) => ({
    id: fid("t", i + 1),
    kind: i % 20 === 0 ? "income" : "expense",
    amountPaisa: (((i * 37) % 90) + 10) * 10_000,
    categoryId: categories[i % categories.length]!.id,
    accountId: accounts[i % accounts.length]!.id,
    paidByUserId: members[i % members.length]!.userId,
    occurredAt: new Date(Date.UTC(2026, 0, 1 + (i % 28), 6, 0, 0)).toISOString(),
    note: null,
  }));
  const budgets: BudgetRow[] = categories.map((c, i) => ({
    categoryId: c.id,
    nameBn: c.nameBn,
    nameEn: c.nameEn,
    limitPaisa: (i + 1) * 1_000_000,
    spentPaisa: (i + 1) * 800_000,
    level: i === 0 ? "warning" : "ok",
    inherited: false,
  }));
  return {
    family,
    me: { id: members[0]!.userId, phone: members[0]!.phone, name: "আব্বু" },
    members,
    accounts,
    categories,
    budgets,
    transactions,
  };
}
