import { and, eq, isNull, or, type SQL } from "drizzle-orm";
import type { Viewer } from "../domain/viewer.js";
import { transactions } from "../schema.js";

/** Not someone else's private entry (FR-TXN-05). Tombstones are not excluded: sync must deliver them. */
export const notPrivateToOthers = (userId: string) =>
  or(eq(transactions.isPrivate, false), eq(transactions.createdBy, userId));

/** The single "rows this viewer may read" predicate: this family, not deleted, privacy applied (FR-TXN-05). */
export function visibleTo(familyId: string, viewer: Viewer): SQL {
  const privacy = viewer === "family" ? eq(transactions.isPrivate, false) : notPrivateToOthers(viewer.userId);
  return and(eq(transactions.familyId, familyId), isNull(transactions.deletedAt), privacy)!;
}
