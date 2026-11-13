import { amountInWords } from "@amar-poribar/shared";
import type { BudgetLevel } from "./level.js";

export interface StatusWords {
  level: BudgetLevel;
  icon: "check" | "warning" | "error";
  labelBn: string;
  labelEn: string;
  speechBn: string;
}

const LABELS: Record<BudgetLevel, Pick<StatusWords, "icon" | "labelBn" | "labelEn">> = {
  ok: { icon: "check", labelBn: "ঠিক আছে", labelEn: "OK" },
  warning: { icon: "warning", labelBn: "সাবধান", labelEn: "Careful" },
  exceeded: { icon: "error", labelBn: "বাজেট শেষ", labelEn: "Over budget" },
};

/**
 * Icon and words for a budget level, plus text that can be read aloud (FR-BUD-07).
 * Speech uses amounts in words, never digits or percentages.
 */
export function statusWords(level: BudgetLevel, ctx: { categoryNameBn: string; overPaisa: number }): StatusWords {
  const name = `${ctx.categoryNameBn} খাতের বাজেট`;
  let speechBn: string;
  if (level === "warning") speechBn = `${name} প্রায় শেষ`;
  else if (level === "exceeded") {
    speechBn = ctx.overPaisa > 0 ? `${name} শেষ, ${amountInWords(ctx.overPaisa, "bn")} বেশি` : `${name} শেষ`;
  } else speechBn = `${name} ঠিক আছে`;
  return { level, ...LABELS[level], speechBn };
}
