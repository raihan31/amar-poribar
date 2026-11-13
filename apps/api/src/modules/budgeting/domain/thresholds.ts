export const THRESHOLDS = [80, 100] as const;
export type Threshold = (typeof THRESHOLDS)[number];

/** Thresholds (ascending) that `spentPaisa` has reached for `limitPaisa`. Integer math only; a limit of zero or less never alerts. */
export function reachedThresholds(spentPaisa: number, limitPaisa: number): Threshold[] {
  if (limitPaisa <= 0) return [];
  return THRESHOLDS.filter((t) => spentPaisa * 100 >= limitPaisa * t);
}

export const levelOf = (t: Threshold): "warning" | "exceeded" => (t === 100 ? "exceeded" : "warning");
