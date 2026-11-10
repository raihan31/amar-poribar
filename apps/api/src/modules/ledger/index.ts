import type { CreateTransactionInput, Role, SyncTransaction } from "@amar-poribar/shared";
import type { Tx } from "../../platform/events/bus.js";
import type { ModuleDefinition } from "../../platform/module.js";
import { createTransaction } from "./app/create-transaction.js";
import { assertNoClockDrift } from "./app/clock-drift.js";
import { getCategoryByKey, listCategories } from "./app/categories.js";
import type { LedgerDeps } from "./app/deps.js";
import { applyChange, type ApplyResult } from "./app/apply-sync-change.js";
import { assertOwnedRefs } from "./app/refs.js";
import { listChangesAfter, type ChangesPage } from "./app/list-for-sync.js";
import { expenseTotalBetween, monthTotals, type MonthTotals } from "./app/month-totals.js";
import { remittanceByMonth, type RemittanceByMonth } from "./app/remittance.js";
import { seedDefaults } from "./app/seed-defaults.js";
import { currentDhakaMonth, dayRange, monthRange, monthsBetween, previousMonth } from "../../platform/time/month.js";
import { nextHlc } from "./domain/hlc.js";
import { accountsRoutes } from "./http/accounts.routes.js";
import { categoriesRoutes } from "./http/categories.routes.js";
import { transactionsRoutes } from "./http/transactions.routes.js";
import type { Account, Category } from "./infra/catalog.repo.js";
import { totalsRepo, type ExportRow } from "./infra/totals.repo.js";
import type { Transaction } from "./infra/transactions.repo.js";
export * from "./events.js";

export type { Account, ApplyResult, Category, ChangesPage, ExportRow, MonthTotals, RemittanceByMonth, Transaction };
export { currentDhakaMonth, dayRange, monthRange, monthsBetween, previousMonth, nextHlc, assertNoClockDrift };

/** Public surface of the ledger module. Other modules may import only this file (SRS R1). */
export interface LedgerFacade {
  readonly name: "ledger";
  /** Income, expense and breakdowns for a month, as visible to `userId` (FR-TXN-05). */
  monthTotals(familyId: string, userId: string, month: string): Promise<MonthTotals>;
  /** Expense in `[start, end)` as visible to `userId` (festival budgets). */
  expenseTotalBetween(familyId: string, userId: string, start: Date, end: Date): Promise<number>;
  listCategories(familyId: string): Promise<Category[]>;
  getCategoryByKey(familyId: string, key: string): Promise<Category | null>;
  /** The caller has already checked the member role (for example recurring confirm). */
  createTransaction(familyId: string, actor: { userId: string }, input: CreateTransactionInput): Promise<Transaction>;
  /** 400 `invalid_category` / `invalid_account` unless the category and account belong to this family. */
  assertOwnedRefs(
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
      seedDefaults(tx, event.payload.familyId, event.payload.createdBy),
    );
    return {
      name: "ledger",
      monthTotals: (familyId, userId, month) => monthTotals(deps, familyId, userId, month),
      expenseTotalBetween: (familyId, userId, start, end) => expenseTotalBetween(deps, familyId, userId, start, end),
      listCategories: (familyId) => listCategories(deps, familyId),
      getCategoryByKey: (familyId, key) => getCategoryByKey(deps, familyId, key),
      createTransaction: (familyId, actor, data) => createTransaction(deps, { familyId, actorId: actor.userId, data }),
      assertOwnedRefs: (familyId, refs) => assertOwnedRefs(ctx.db, familyId, refs),
      listForExport: (familyId, userId, range) => totalsRepo.exportRows(ctx.db, familyId, userId, range),
      remittanceByMonth: (familyId, userId, from, to) => remittanceByMonth(deps, familyId, userId, from, to),
      listChangesAfter: (familyId, userId, role, seq, limit) =>
        listChangesAfter(deps, familyId, userId, role, seq, limit),
      applyChange: (familyId, userId, role, row) => applyChange(deps, familyId, userId, role, row),
      seedDefaults: (tx, familyId, ownerUserId = null) => seedDefaults(tx, familyId, ownerUserId),
    };
  },
};
