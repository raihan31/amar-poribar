import type { ListTransactionsQuery, TransactionListItem, TransactionPage } from "@amar-poribar/shared";
import type { Transaction } from "../infra/transactions.repo.js";
import { encodeCursor } from "../domain/cursor.js";
import { dhakaDayKey, toFilter } from "../domain/filter.js";
import { queryRepo } from "../infra/query-repo.js";
import type { LedgerDeps } from "./deps.js";

const unique = (ids: (string | null)[]) => [...new Set(ids.filter((i): i is string => i !== null))];

/** One page of the family's transactions as `userId` may see them (FR-TXN-02, FR-TXN-05). */
export async function listTransactions(
  deps: LedgerDeps,
  input: { familyId: string; userId: string; query: ListTransactionsQuery },
): Promise<TransactionPage> {
  const filter = toFilter(input.query);
  const fetched = await queryRepo.page(deps.db, input.familyId, { userId: input.userId }, filter);
  const rows = fetched.slice(0, filter.limit);
  const last = rows[rows.length - 1];

  const items = await toListItems(deps, rows, input.userId);
  return { items, nextCursor: fetched.length > filter.limit && last ? encodeCursor(last) : null };
}

/** Rows as list items: category, account and payer names resolved in three batched lookups. */
export async function toListItems(
  deps: LedgerDeps,
  rows: Transaction[],
  userId: string,
): Promise<TransactionListItem[]> {
  const [cats, accs, people] = await Promise.all([
    queryRepo.categoryNames(deps.db, unique(rows.map((r) => r.categoryId))),
    queryRepo.accountNames(deps.db, unique(rows.map((r) => r.accountId))),
    deps.families.getUserLabels(unique(rows.map((r) => r.paidByUserId))),
  ]);

  return rows.map((r) => {
    const cat = r.categoryId ? cats.get(r.categoryId) : undefined;
    return {
      id: r.id,
      type: r.type,
      amountPaisa: r.amountPaisa,
      feePaisa: r.feePaisa,
      occurredAt: r.occurredAt.toISOString(),
      dayKey: dhakaDayKey(r.occurredAt),
      categoryId: r.categoryId,
      categoryNameBn: cat?.nameBn ?? null,
      categoryNameEn: cat?.nameEn ?? null,
      accountId: r.accountId,
      accountName: r.accountId ? (accs.get(r.accountId) ?? null) : null,
      paidByUserId: r.paidByUserId,
      paidByName: r.paidByUserId ? (people.get(r.paidByUserId) ?? null) : null,
      createdBy: r.createdBy,
      note: r.note,
      counterparty: r.counterparty,
      source: r.source,
      isPrivate: r.isPrivate,
      isMine: r.createdBy === userId,
      // Attachments arrive with receipts (M7); no row has one yet.
      hasAttachment: false,
    };
  });
}
