import type { FixtureAccount, FixtureCategory } from "./families.js";
import { ok, type ApiClient } from "./users.js";

/** Small deterministic PRNG (mulberry32). Same seed, same sequence. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MakeTransactionsOptions {
  seed: number;
  /** Categories and accounts to draw from; loaded from the API when omitted. */
  categories?: FixtureCategory[];
  accounts?: FixtureAccount[];
  /** Entries are spread over the `days` before `endsAt`. */
  days?: number;
  endsAt?: Date;
  /** Share of private entries, 0..1. Default 0.1. */
  privateShare?: number;
}

export interface FixtureTransaction {
  id: string;
  type: "expense" | "income";
  amountPaisa: number;
  occurredAt: string;
  categoryId: string;
  accountId: string;
  isPrivate: boolean;
}

/** Records `n` transactions (about 1 in 8 is income) with a deterministic mix for `seed`. Money is integer paisa. */
export async function makeTransactions(
  api: ApiClient,
  token: string,
  familyId: string,
  n: number,
  opts: MakeTransactionsOptions,
): Promise<FixtureTransaction[]> {
  const categories =
    opts.categories ??
    ok(await api.get<FixtureCategory[]>(`/v1/families/${familyId}/categories`, { token }), "categories");
  const accounts =
    opts.accounts ?? ok(await api.get<FixtureAccount[]>(`/v1/families/${familyId}/accounts`, { token }), "accounts");
  const expense = categories.filter((c) => c.kind === "expense");
  const income = categories.filter((c) => c.kind === "income");
  const rand = rng(opts.seed);
  const days = opts.days ?? 90;
  const end = (opts.endsAt ?? new Date("2026-01-15T06:00:00.000Z")).getTime();
  const privateShare = opts.privateShare ?? 0.1;
  const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]!;

  const out: FixtureTransaction[] = [];
  for (let i = 0; i < n; i++) {
    const isIncome = income.length > 0 && rand() < 0.125;
    const category = pick(isIncome ? income : expense);
    // Whole taka between 20 and 5,000 (income up to 60,000), stored as paisa.
    const taka = isIncome ? 5000 + Math.floor(rand() * 55_000) : 20 + Math.floor(rand() * 4_980);
    const body = {
      type: isIncome ? ("income" as const) : ("expense" as const),
      amountPaisa: taka * 100,
      occurredAt: new Date(end - Math.floor(rand() * days * 86_400_000)).toISOString(),
      categoryId: category.id,
      accountId: pick(accounts).id,
      note: `fixture ${opts.seed}-${i}`,
      isPrivate: rand() < privateShare,
    };
    const row = ok(
      await api.post<{ id: string }>(`/v1/families/${familyId}/transactions`, body, { token }),
      "transaction",
    );
    out.push({ ...body, id: row.id });
  }
  return out;
}

const MAIN_LIMITS_TAKA: Record<string, number> = {
  bazaar: 15_000,
  rent: 18_000,
  electricity: 2_500,
  transport: 4_000,
  education: 6_000,
  medical: 3_000,
};

/** Sets a month's budgets (default: current): an overall limit plus limits for the main expense categories. */
export async function makeBudgets(
  api: ApiClient,
  token: string,
  familyId: string,
  opts: { month?: string; categories?: FixtureCategory[]; overallPaisa?: number } = {},
): Promise<{ month: string; updated: number }> {
  const categories =
    opts.categories ??
    ok(await api.get<FixtureCategory[]>(`/v1/families/${familyId}/categories`, { token }), "categories");
  const budgets = [
    { categoryId: null as string | null, limitPaisa: opts.overallPaisa ?? 60_000 * 100 },
    ...categories.flatMap((c) => {
      const taka = MAIN_LIMITS_TAKA[c.key];
      return taka ? [{ categoryId: c.id, limitPaisa: taka * 100 }] : [];
    }),
  ];
  const query = opts.month ? `?month=${opts.month}` : "";
  return ok(
    await api.put<{ month: string; updated: number }>(
      `/v1/families/${familyId}/budgets${query}`,
      { budgets },
      { token },
    ),
    "budgets",
  );
}
