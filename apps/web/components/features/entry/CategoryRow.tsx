"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { Category } from "@/lib/types";
import { CategoryGrid } from "./CategoryGrid";

const SHOWN = 5;

/** Five category icons and "আরও", which opens the full A4 grid in a sheet. */
export function CategoryRow({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  selectedId: string | null | undefined;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const { name } = useFormat();
  const [open, setOpen] = useState(false);

  const selected = categories.find((c) => c.id === selectedId) ?? null;
  const first = categories.slice(0, SHOWN);
  // Keep the chosen category visible even when it lives behind "আরও".
  const shown = selected && !first.includes(selected) ? [...first.slice(0, SHOWN - 1), selected] : first;

  return (
    <>
      <div className="entry-catrow" role="group" aria-label={t("category.label")}>
        {shown.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === selectedId}
            className={c.id === selectedId ? "entry-cat-tile entry-cat-tile--on" : "entry-cat-tile"}
            onClick={() => onSelect(c.id)}
          >
            <span className="entry-cat-icon" aria-hidden="true">
              {c.icon}
            </span>
            <span>{name(c)}</span>
          </button>
        ))}
        {categories.length > SHOWN && (
          <button type="button" className="entry-cat-tile" onClick={() => setOpen(true)}>
            <span className="entry-cat-icon" aria-hidden="true">
              …
            </span>
            <span>{t("entry.form.more")}</span>
          </button>
        )}
      </div>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("entry.form.allCategories")}
        closeLabel={t("fam.close")}
      >
        <CategoryGrid
          categories={categories}
          selectedKey={selected?.key ?? null}
          onSelect={(key) => {
            const c = categories.find((x) => x.key === key);
            if (c) onSelect(c.id);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}
