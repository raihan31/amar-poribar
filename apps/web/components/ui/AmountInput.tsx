"use client";

import { useId } from "react";
import { amountInWords, formatBDT } from "@amar-poribar/shared";

/** Bengali digits U+09E6..U+09EF, built from code points so no Bangla literal sits in a component. */
const BN_ZERO = 0x09e6;
const toBn = (latin: string) => latin.replace(/\d/g, (d) => String.fromCharCode(BN_ZERO + Number(d)));
const toLatin = (s: string) =>
  [...s]
    .map((c) => {
      const n = c.charCodeAt(0) - BN_ZERO;
      return n >= 0 && n <= 9 ? String(n) : c;
    })
    .join("")
    .replace(/\D/g, "");

export interface AmountInputProps {
  label: string;
  /** Integer paisa. */
  valuePaisa: number;
  onChange: (paisa: number) => void;
  lang?: "bn" | "en";
}

/** Whole-taka entry; shows the amount in digits and in words beneath. */
export function AmountInput({ label, valuePaisa, onChange, lang = "bn" }: AmountInputProps) {
  const id = useId();
  const taka = Math.floor(valuePaisa / 100);
  const text = valuePaisa === 0 ? "" : lang === "bn" ? toBn(String(taka)) : String(taka);

  const parse = (raw: string) => {
    const latin = toLatin(raw);
    onChange(latin ? Number(latin) * 100 : 0);
  };

  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(e) => parse(e.target.value)}
        aria-describedby={`${id}-words`}
      />
      <p className="ui-amount__display">{formatBDT(valuePaisa, { bnDigits: lang === "bn" })}</p>
      <p id={`${id}-words`} className="ui-amount__words" aria-live="polite">
        {valuePaisa === 0 ? "" : amountInWords(valuePaisa, lang)}
      </p>
    </div>
  );
}
