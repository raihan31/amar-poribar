"use client";

import { useRef } from "react";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { Category } from "@/lib/types";

const LONG_PRESS_MS = 600;

/** 100 px tile: icon and name. Hidden categories are dashed, grey and say "লুকানো". */
export function CategoryTile(props: {
  category: Category;
  /** Editors can open the edit sheet (long press, or a tap while renaming). */
  canEdit: boolean;
  editing: boolean;
  onEdit: (c: Category) => void;
}) {
  const { category, canEdit, editing, onEdit } = props;
  const t = useT();
  const { name } = useFormat();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const hidden = category.isHidden === true;
  const cls = `ledger-tile${hidden ? " ledger-tile--hidden" : ""}`;
  const body = (
    <>
      <span className="ledger-tile__icon" aria-hidden="true">
        {category.icon ?? "📦"}
      </span>
      <span>{name(category)}</span>
      {hidden && <small>{t("cat.hidden")}</small>}
    </>
  );
  if (!canEdit) return <li className={cls}>{body}</li>;

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <li>
      <button
        type="button"
        className={cls}
        onPointerDown={() => {
          fired.current = false;
          timer.current = setTimeout(() => {
            fired.current = true;
            onEdit(category);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onClick={() => {
          if (editing && !fired.current) onEdit(category);
        }}
      >
        {body}
      </button>
    </li>
  );
}
