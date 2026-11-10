import { and, eq, isNull, or } from "drizzle-orm";
import { transactions } from "../schema.js";

/** Not someone else's private entry (FR-TXN-05). Tombstones are not excluded: sync must deliver them. */
export const notPrivateToOthers = (userId: string) =>
  or(eq(transactions.isPrivate, false), eq(transactions.createdBy, userId));

/** Rows the caller may see: this family, not deleted, and not someone else's private entry (FR-TXN-05). */
export const visibleToCaller = (familyId: string, userId: string) =>
  and(eq(transactions.familyId, familyId), isNull(transactions.deletedAt), notPrivateToOthers(userId));
