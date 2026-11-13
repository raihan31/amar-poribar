/**
 * Who is looking. `{ userId }` sees the family's entries minus other members' private ones; `"family"` is the
 * family-wide view (alerts, staff-safe counts) and sees no private entry at all (FR-TXN-05, DEC-18).
 * The SQL predicate lives in `infra/visibility.ts` (`visibleTo`), because domain code stays free of the database.
 */
export type Viewer = { userId: string } | "family";
