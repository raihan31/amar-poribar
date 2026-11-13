"use client";

import { Chip } from "@/components/ui/Chip";
import { useT } from "@/lib/i18n/useT";

/** The fixed 20-icon set for categories (FR-CAT-02), taken from the default categories. */
export const CATEGORY_ICONS = [
  "🛒",
  "🏠",
  "💡",
  "🔥",
  "🚰",
  "📶",
  "📱",
  "🛺",
  "📚",
  "💊",
  "🧹",
  "👕",
  "🍛",
  "🤝",
  "🕌",
  "🎉",
  "🎁",
  "🧺",
  "🎬",
  "📦",
] as const;

export function IconPicker({ value, onChange }: { value: string | null; onChange: (icon: string) => void }) {
  const t = useT();
  return (
    <div role="group" aria-label={t("cat.iconLabel")} className="ledger-icons">
      {CATEGORY_ICONS.map((i) => (
        <Chip key={i} selected={i === value} onClick={() => onChange(i)}>
          {i}
        </Chip>
      ))}
    </div>
  );
}
