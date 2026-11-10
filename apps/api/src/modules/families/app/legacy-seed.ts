import { DEFAULT_CATEGORIES } from "@amar-poribar/shared";
import { accounts, categories } from "../../../db/schema.js";
import type { Tx } from "../../../platform/events/bus.js";
import type { SeedDefaults } from "./deps.js";

const UNDEFINED_TABLE = "42P01";

function isMissingTable(e: unknown): boolean {
  let err = e as { code?: string; cause?: unknown } | undefined;
  for (let i = 0; err && i < 5; i++) {
    if (err.code === UNDEFINED_TABLE) return true;
    err = err.cause as typeof err;
  }
  return false;
}

/**
 * Seeding that used to live in `POST /v1/families`. Remove in T-PLAT-25, when `ledger` seeds itself from
 * `families.FamilyCreated.v1`. The legacy tables have no migration yet, so a missing table is tolerated
 * (inside a savepoint, so the family insert survives).
 */
export const legacySeed: SeedDefaults = async (tx: Tx, { familyId, userId }) => {
  try {
    await tx.transaction(async (sp) => {
      await sp.insert(categories).values(DEFAULT_CATEGORIES.map((c) => ({ ...c, familyId })));
      await sp.insert(accounts).values([
        { familyId, name: "Cash / নগদ", type: "cash" as const },
        { familyId, name: "bKash", type: "bkash" as const, ownerUserId: userId },
      ]);
    });
  } catch (e) {
    if (!isMissingTable(e)) throw e;
  }
};
