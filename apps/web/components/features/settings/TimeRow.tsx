"use client";

import { useId } from "react";

export interface TimeRowProps {
  /** Visible label and accessible name of the time input. */
  label: string;
  /** "HH:mm", 24-hour. */
  value: string;
  onChange: (value: string) => void;
}

/** A row with a native time picker; an empty value (cleared picker) is ignored. */
export function TimeRow({ label, value, onChange }: TimeRowProps) {
  const id = useId();
  return (
    <div className="set-row">
      <label htmlFor={id} className="set-row__text">
        <span className="set-row__title">{label}</span>
      </label>
      <input
        id={id}
        type="time"
        className="set-time"
        value={value}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      />
    </div>
  );
}
