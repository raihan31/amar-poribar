"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Toggle } from "@/components/ui/Toggle";
import { useT } from "@/lib/i18n/useT";
import type { Category } from "@/lib/types";
import { IconPicker } from "./IconPicker";

export type CategoryChange =
  | { kind: "expense" | "income"; nameBn: string; nameEn: string; icon?: string }
  | { nameBn: string; nameEn: string; icon: string | null; isHidden: boolean };

interface Props {
  open: boolean;
  /** `null` creates a new category of `kind`. */
  category: Category | null;
  kind: "expense" | "income";
  onSave: (change: CategoryChange) => void;
  onClose: () => void;
}

/** Edit or create a category: names, icon, hide/show. Hiding never deletes (FR-CAT-02, FR-ACC-04 spirit). */
export function CategoryEditSheet(props: Props) {
  // Remount per target so the draft always starts from the category being edited.
  return <SheetBody key={props.category?.id ?? "new"} {...props} />;
}

function SheetBody({ open, category, kind, onSave, onClose }: Props) {
  const t = useT();
  const [nameBn, setNameBn] = useState(category?.nameBn ?? "");
  const [nameEn, setNameEn] = useState(category?.nameEn ?? "");
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null);
  const [hidden, setHidden] = useState(category?.isHidden === true);
  const valid = nameBn.trim() !== "" && nameEn.trim() !== "";

  function save() {
    if (!valid) return;
    const names = { nameBn: nameBn.trim(), nameEn: nameEn.trim() };
    if (category) onSave({ ...names, icon, isHidden: hidden });
    else onSave({ kind, ...names, ...(icon ? { icon } : {}) });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={category ? t("cat.editTitle") : t("cat.new")}
      closeLabel={t("fam.close")}
    >
      <div className="ledger-form">
        <Field label={t("nameBn")} value={nameBn} maxLength={60} onChange={(e) => setNameBn(e.target.value)} />
        <Field label={t("nameEn")} value={nameEn} maxLength={60} onChange={(e) => setNameEn(e.target.value)} />
        <IconPicker value={icon} onChange={setIcon} />
        {category && (
          <div className="ledger-hide">
            <Toggle label={t("hide")} checked={hidden} onChange={setHidden} />
            <span>{t("hide")}</span>
            <small className="muted">{t("cat.hideNote")}</small>
          </div>
        )}
        <Button size="lg" disabled={!valid} onClick={save}>
          {t("entry.form.keep")}
        </Button>
      </div>
    </Sheet>
  );
}
