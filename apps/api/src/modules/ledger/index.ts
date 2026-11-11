import type { CreateTransactionInput, Role, SyncTransaction } from "@amar-poribar/shared";
import type { Tx } from "../../platform/events/bus.js";
import type { ModuleDefinition } from "../../platform/module.js";
import { createTransaction } from "./app/create-transaction.js";
import type { LedgerDeps } from "./app/deps.js";
import { applyChange, type ApplyResult } from "./app/apply-sync-change.js";
import {
  assertRefs,
  countTransactions,
  getCategoriesByKeys,
  getLastActivity,
  listAccounts,
  listCategories,
  listVisibleTransactions,
} from "./app/queries.js";
import { onFamilyDeleted } from "./app/on-family-deleted.js";
import type { Viewer } from "./domain/viewer.js";
import type { VisibleFilter } from "./infra/query-repo.js";
import { listChangesAfter, type ChangesPage } from "./app/list-for-sync.js";
import { askQueries, type AskQueries } from "./app/ask-queries.js";
import { getMonthTotals, getRangeTotals, type MonthTotals, type RangeTotals } from "./app/month-totals.js";
import { remittanceByMonth, type RemittanceByMonth } from "./app/remittance.js";
import { getMonthlySeries, type MonthlyPoint } from "./app/series.js";
import { seedDefaults } from "./app/seed-defaults.js";
import { currentDhakaMonth, dayRange, monthRange, monthsBetween, previousMonth } from "../../platform/time/month.js";
import { nextHlc } from "../../platform/hlc.js";
import { accountsRoutes } from "./http/accounts.routes.js";
import { categoriesRoutes } from "./http/categories.routes.js";
import { transactionsRoutes } from "./http/transactions.routes.js";
import type { Account, Category } from "./infra/catalog.repo.js";
import { totalsRepo, type ExportRow } from "./infra/totals.repo.js";
import type { Transaction } from "./infra/transactions.repo.js";
export * from "./events.js";

export type {
  Account,
  Account as AccountDto,
  Category as CategoryDto,
  Transaction as TransactionDto,
  ApplyResult,
  AskQueries,
  Category,
  ChangesPage,
  ExportRow,
  MonthlyPoint,
  MonthTotals,
  RangeTotals,
  RemittanceByMonth,
  Transaction,
  Viewer,
  VisibleFilter,
};
export { currentDhakaMonth, dayRange, monthRange, monthsBetween, previousMonth, nextHlc };

/** Public surface of the ledger module. Other modules may import only this file (SRS R1). */
export interface LedgerFacade {
  readonly name: "ledger";
  /** Income, expense and breakdowns for a month, as visible to `viewer` (FR-TXN-05). */
  getMonthTotals(familyId: string, viewer: Viewer, month: string): Promise<MonthTotals>;
  /** Income, expense and per-category expense in `[from, to)` as visible to `viewer` (festival budgets). */
  getRangeTotals(familyId: string, viewer: Viewer, from: Date, to: Date): Promise<RangeTotals>;
  /** Zero-filled monthly income and expense (with per-category-key split) from `fromMonth` to `toMonth` inclusive. */
  getMonthlySeries(familyId: string, viewer: Viewer, fromMonth: string, toMonth: string): Promise<MonthlyPoint[]>;
  /** Newest first; other members' private entries are excluded (FR-TXN-05). */
  listVisibleTransactions(familyId: string, viewer: Viewer, filter: VisibleFilter): Promise<Transaction[]>;
  /** Read-only queries for the Ask feature; other members' private entries are never read (FR-TXN-05). */
  askQueries(familyId: string, userId: string): AskQueries;
  listCategories(familyId: string, opts: { includeHidden: boolean }): Promise<Category[]>;
  listAccounts(familyId: string, opts: { includeArchived: boolean }): Promise<Account[]>;
  getCategoriesByKeys(familyId: string, keys: readonly string[]): Promise<Category[]>;
  /** `max(updated_at)` over the family's transactions, or null when it has none. */
  getLastActivity(familyId: string): Promise<Date | null>;
  countTransactions(familyId: string): Promise<number>;
  /** The caller has already checked the member role (for example recurring confirm). */
  createTransaction(familyId: string, actor: { userId: string }, input: CreateTransactionInput): Promise<Transaction>;
  /** 400 `invalid_category` / `invalid_account` unless the category and account belong to this family. */
  assertRefs(
    familyId: string,
    refs: { categoryId?: string | null | undefined; accountId?: string | null | undefined },
  ): Promise<void>;
  /** Oldest first; other members' private entries are excluded (FR-TXN-05). */
  listForExport(familyId: string, userId: string, range: { start: Date; end: Date }): AsyncIterable<ExportRow>;
  /** Remittance received vs. spending for each month from `from` to `to` (YYYY-MM, inclusive). */
  remittanceByMonth(familyId: string, userId: string, from: string, to: string): Promise<RemittanceByMonth>;
  listChangesAfter(familyId: string, userId: string, role: Role, seq: number, limit?: number): Promise<ChangesPage>;
  applyChange(familyId: string, userId: string, role: Role, row: SyncTransaction): Promise<ApplyResult>;
  /** Runs inside the caller's transaction; also registered for `families.FamilyCreated.v1`. */
  seedDefaults(tx: Tx, familyId: string, ownerUserId?: string | null): Promise<void>;
}

declare module "../../platform/module.js" {
  interface Facades {
    ledger: LedgerFacade;
  }
}

export const ledgerModule: ModuleDefinition<LedgerFacade> = {
  name: "ledger",
  dependsOn: ["families"],
  register(app, ctx) {
    const families = ctx.facades.families;
    if (!families) throw new Error("ledger: families must be registered first");
    const deps: LedgerDeps = { db: ctx.db, bus: ctx.bus, families };
    accountsRoutes(app, deps);
    categoriesRoutes(app, deps);
    transactionsRoutes(app, deps);
    // Invariant, not a notification: a family without categories must not exist (SRS §3.5).
    ctx.bus.onInTx("families.FamilyCreated.v1", (event, tx) =>
      seedDefaults(tx, event.payload.familyId, event.payload.ownerUserId),
    );
    // The event is declared by families (T-FAM); the payload is read defensively until its type exists.
    ctx.bus.on("families.FamilyDeleted.v1", "ledger.delete-family-data", async (event, hctx) => {
      const { familyId } = event.payload as { familyId: string };
      await onFamilyDeleted(hctx.db, ctx.storage, familyId);
    });
    return {
      name: "ledger",
      getMonthTotals: (familyId, viewer, month) => getMonthTotals(deps, familyId, viewer, month),
      getRangeTotals: (familyId, viewer, from, to) => getRangeTotals(deps, familyId, viewer, from, to),
      getMonthlySeries: (familyId, viewer, from, to) => getMonthlySeries(deps, familyId, viewer, from, to),
      listVisibleTransactions: (familyId, viewer, filter) => listVisibleTransactions(deps, familyId, viewer, filter),
      askQueries: (familyId, userId) => askQueries(deps, familyId, userId),
      listCategories: (familyId, opts) => listCategories(deps, familyId, opts),
      listAccounts: (familyId, opts) => listAccounts(deps, familyId, opts),
      getCategoriesByKeys: (familyId, keys) => getCategoriesByKeys(deps, familyId, keys),
      getLastActivity: (familyId) => getLastActivity(deps, familyId),
      countTransactions: (familyId) => countTransactions(deps, familyId),
      createTransaction: (familyId, actor, data) => createTransaction(deps, { familyId, actorId: actor.userId, data }),
      assertRefs: (familyId, refs) => assertRefs(ctx.db, familyId, refs),
      listForExport: (familyId, userId, range) => totalsRepo.exportRows(ctx.db, familyId, { userId }, range),
      remittanceByMonth: (familyId, userId, from, to) => remittanceByMonth(deps, familyId, userId, from, to),
      listChangesAfter: (familyId, userId, role, seq, limit) =>
        listChangesAfter(deps, familyId, userId, role, seq, limit),
      applyChange: (familyId, userId, role, row) => applyChange(deps, familyId, userId, role, row),
      seedDefaults: (tx, familyId, ownerUserId = null) => seedDefaults(tx, familyId, ownerUserId),
    };
  },
};
