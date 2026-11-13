"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/icons";
import type { DraftView } from "@/lib/entry/quickParse";
import { useDraftLabels } from "@/lib/entry/useDraftLabels";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import { speak } from "@/lib/speech/synthesis";
import type { Category } from "@/lib/types";

const TILE = 104;
/** A tap focuses first, then clicks; speak once for that pair. */
const FOCUS_CLICK_GAP_MS = 400;

/** A4 tiles: tapping or focusing speaks the category name, then selects it (FR-VOICE-06). */
export function CategoryGrid({
  categories,
  selectedKey,
  onSelect,
}: {
  categories: Category[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const t = useT();
  const { name } = useFormat();
  const focusedAt = useRef(0);
  return (
    <div className="entry-grid" role="group" aria-label={t("category.label")}>
      {categories.map((c) => {
        const selected = c.key === selectedKey;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={selected}
            aria-label={name(c)}
            className={selected ? "entry-cat-tile entry-cat-tile--on" : "entry-cat-tile"}
            style={{ minHeight: TILE }}
            onFocus={() => {
              focusedAt.current = Date.now();
              speak(name(c), { interrupt: true });
            }}
            onClick={() => {
              if (Date.now() - focusedAt.current > FOCUS_CLICK_GAP_MS) speak(name(c), { interrupt: true });
              onSelect(c.key);
            }}
          >
            <span className="entry-cat-icon" aria-hidden="true">
              {c.icon ?? <Icon name="list" size={36} />}
            </span>
            <span>{name(c)}</span>
            {selected && (
              <span className="entry-cat-check" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A4 header card: amount, words, account and day, with a speaker button. */
export function PickerHeader({ view }: { view: DraftView }) {
  const t = useT();
  const labels = useDraftLabels();
  const d = view.draft;
  const line = [labels.amount(d), labels.words(d), labels.metaShort(d)].filter(Boolean).join(" · ");
  return (
    <div className="entry-pickhead">
      <span>{line}</span>
      <button
        type="button"
        className="entry-pickhead-btn"
        aria-label={t("entry.listenAgain")}
        onClick={() => speak(labels.sentence(d, view.category), { interrupt: true })}
      >
        <Icon name="speaker" size={26} />
      </button>
    </div>
  );
}
