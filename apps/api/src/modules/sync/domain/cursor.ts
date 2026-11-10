/**
 * The sync cursor is opaque to devices: today it is the decimal `syncSeq` of the last row delivered.
 * A missing, empty or malformed cursor means "from the start".
 */
export function parseCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const n = Number(cursor);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export function formatCursor(seq: number): string {
  return String(seq);
}
