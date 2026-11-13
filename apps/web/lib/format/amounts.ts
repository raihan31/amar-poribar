/** Splits server text into plain and "৳ amount" parts, so amounts can be shown bold (B2, B5). */
export type AmountPart = { kind: "text" | "amount"; value: string };

const AMOUNT = /৳\s?[0-9০-৯][0-9০-৯,]*(?:\.[0-9০-৯]+)?/g;

export function splitAmounts(text: string): AmountPart[] {
  const parts: AmountPart[] = [];
  let last = 0;
  for (const m of text.matchAll(AMOUNT)) {
    if (m.index > last) parts.push({ kind: "text", value: text.slice(last, m.index) });
    parts.push({ kind: "amount", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** First "৳ amount" in the text as whole paisa (digits in either script), or null. */
export function firstAmountPaisa(text: string): number | null {
  const found = text.match(AMOUNT)?.[0];
  if (!found) return null;
  const latin = found
    .replace(/[^0-9০-৯.]/g, "")
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .split(".");
  const taka = Number(latin[0]);
  const paisa = Number((latin[1] ?? "").padEnd(2, "0").slice(0, 2));
  return Number.isFinite(taka) ? taka * 100 + (Number.isFinite(paisa) ? paisa : 0) : null;
}

/** Sentences end with "।", ".", "!" or "?" followed by a space. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[।.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "Spending rose": the change sentence compares with last month and says more (bn "বেশি"). */
export function spendingRose(sentence: string): boolean {
  return /(গত মাস[^।]*বেশি)|(\bmore\b[^.]*last month)/i.test(sentence);
}
