"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

const LENGTH = 6;

export interface OtpBoxesProps {
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  /** Accessible name of the box at 1-based position i. */
  boxLabel: (position: number) => string;
  disabled?: boolean;
}

export function OtpBoxes({ onChange, onComplete, boxLabel, disabled }: OtpBoxesProps) {
  const [digits, setDigits] = useState<string[]>(() => Array<string>(LENGTH).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const commit = (next: string[]) => {
    setDigits(next);
    const code = next.join("");
    onChange?.(code);
    if (code.length === LENGTH && next.every(Boolean)) onComplete?.(code);
  };
  const focus = (i: number) => refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  const onInput = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    commit(next);
    if (d) focus(i + 1);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = "";
      commit(next);
      focus(i - 1);
    } else if (e.key === "ArrowLeft") focus(i - 1);
    else if (e.key === "ArrowRight") focus(i + 1);
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    e.preventDefault();
    // A full code always starts at the first box; a partial paste starts where it landed.
    const start = pasted.length === LENGTH ? 0 : i;
    const next = [...digits];
    [...pasted].slice(0, LENGTH - start).forEach((c, k) => (next[start + k] = c));
    commit(next);
    focus(Math.min(start + pasted.length, LENGTH - 1));
  };

  return (
    <div className="ui-otp">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={d}
          disabled={disabled}
          aria-label={boxLabel(i + 1)}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
