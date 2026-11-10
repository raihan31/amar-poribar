"use client";

import { speak } from "@/lib/voice";
import type { Category } from "@/lib/types";

/** Icon grid so users who can't read comfortably can still choose a category (SRS §4.1.1). */
export function CategoryPicker({ categories, onPick }: { categories: Category[]; onPick: (key: string) => void }) {
  return (
    <div className="picker" role="group" aria-label="ক্যাটাগরি">
      {categories.map((c) => (
        <button
          key={c.id}
          className="picker-item secondary"
          onClick={() => onPick(c.key)}
          onFocus={() => speak(c.nameBn)}
          title={c.nameBn}
          aria-label={c.nameBn}
        >
          <span aria-hidden="true">{c.icon}</span>
          <small>{c.nameBn}</small>
        </button>
      ))}
    </div>
  );
}
