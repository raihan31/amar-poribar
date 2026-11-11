"use client";

import { speak } from "@/lib/speech/synthesis";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { Category } from "@/lib/types";

/** Icon grid so users who can't read comfortably can still choose a category (SRS §4.1.1). */
export function CategoryPicker({ categories, onPick }: { categories: Category[]; onPick: (key: string) => void }) {
  const t = useT();
  const { name } = useFormat();
  return (
    <div className="picker" role="group" aria-label={t("category.label")}>
      {categories.map((c) => (
        <button
          key={c.id}
          className="picker-item secondary"
          onClick={() => onPick(c.key)}
          onFocus={() => speak(c.nameBn, { interrupt: true })}
          title={name(c)}
          aria-label={name(c)}
        >
          <span aria-hidden="true">{c.icon}</span>
          <small>{name(c)}</small>
        </button>
      ))}
    </div>
  );
}
