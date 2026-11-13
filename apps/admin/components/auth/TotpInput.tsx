"use client";

import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

export const TOTP_LENGTH = 6;

export interface TotpInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/** Six single-digit boxes; typing advances, backspace retreats, paste fills all boxes. */
export function TotpInput({ label, value, onChange, disabled, invalid, describedBy }: TotpInputProps) {
  const id = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(TOTP_LENGTH - 1, i))]?.focus();
  const digits = Array.from({ length: TOTP_LENGTH }, (_, i) => value[i] ?? "");

  function set(i: number, d: string) {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join("").slice(0, TOTP_LENGTH));
  }

  function onInput(i: number, raw: string) {
    const d = raw.replace(/\D/g, "");
    if (!d) return set(i, "");
    if (d.length > 1) return fill(i, d);
    set(i, d);
    focusAt(i + 1);
  }

  function fill(start: number, text: string) {
    const clean = text.replace(/\D/g, "");
    if (!clean) return;
    const next = value.slice(0, start).padEnd(start, " ") + clean;
    const out = next.replace(/ /g, "").slice(0, TOTP_LENGTH);
    onChange(out);
    focusAt(Math.min(start + clean.length, TOTP_LENGTH - 1));
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    fill(text.replace(/\D/g, "").length >= TOTP_LENGTH ? 0 : i, text);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      set(i - 1, "");
      focusAt(i - 1);
    } else if (e.key === "ArrowLeft") focusAt(i - 1);
    else if (e.key === "ArrowRight") focusAt(i + 1);
  }

  return (
    <div className="field">
      <div id={`${id}-l`} className="field__label">
        {label}
      </div>
      <div role="group" aria-labelledby={`${id}-l`} className="totp">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="totp__box"
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            maxLength={TOTP_LENGTH}
            value={d}
            disabled={disabled}
            onChange={(e) => onInput(i, e.target.value)}
            onPaste={(e) => onPaste(i, e)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </div>
  );
}
