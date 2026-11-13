"use client";

import { useState } from "react";
import { parseAmountToPaisa } from "@amar-poribar/shared";
import { api } from "@/lib/api/client";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { BudgetRow, Category, RoleName } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

const OVERALL = "overall";

export interface BudgetEditSheetProps {
  open: boolean;
  onClose: () => void;
  familyId: string;
  month: string;
  role: RoleName;
  rows: BudgetRow[];
  categories: Category[];
  onSaved: () => void;
  onError: (e: unknown) => void;
}

/** "+ বাজেট দিন": owners and admins set limits; blank clears one, unreadable input is left alone (FR-BUD-01). */
export function BudgetEditSheet(props: BudgetEditSheetProps) {
  const { open, onClose, role } = props;
  const t = useT();
  if (role !== "owner" && role !== "admin") return null;
  return (
    <Sheet open={open} onClose={onClose} title={t("bud.add")} closeLabel={t("fam.close")}>
      {open && <EditForm {...props} />}
    </Sheet>
  );
}

function EditForm({ onClose, familyId, month, rows, categories, onSaved, onError }: BudgetEditSheetProps) {
  const t = useT();
  const { name } = useFormat();
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const r of rows) d[r.categoryId ?? OVERALL] = String(r.limitPaisa / 100);
    return d;
  });
  const [busy, setBusy] = useState(false);

  const fields = [
    { key: OVERALL, label: t("budgetOverall") },
    ...categories
      .filter((c) => c.kind === "expense" && !(c as { isHidden?: boolean }).isHidden)
      .map((c) => ({ key: c.id, label: `${c.icon ?? ""} ${name(c)}`.trim() })),
  ];

  async function save() {
    const budgets: { categoryId: string | null; limitPaisa: number }[] = [];
    const keys = new Set([...Object.keys(draft), ...rows.map((r) => r.categoryId ?? OVERALL)]);
    for (const key of keys) {
      const text = (draft[key] ?? "").trim();
      const limitPaisa = text === "" ? 0 : parseAmountToPaisa(text);
      if (limitPaisa === null) continue;
      const before = rows.find((r) => (r.categoryId ?? OVERALL) === key)?.limitPaisa ?? 0;
      if (limitPaisa !== before) budgets.push({ categoryId: key === OVERALL ? null : key, limitPaisa });
    }
    setBusy(true);
    try {
      if (budgets.length) {
        await api(`/v1/families/${familyId}/budgets?month=${month}`, { method: "PUT", body: { budgets } });
      }
      onSaved();
      onClose();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {fields.map((f) => (
        <label key={f.key} className="field-label">
          <span>{f.label}</span>
          <input
            className="field-input"
            inputMode="decimal"
            placeholder="৳"
            aria-label={t("bud.amountLabel", { name: f.label })}
            value={draft[f.key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
          />
        </label>
      ))}
      <Button size="lg" disabled={busy} onClick={save}>
        {t("budgetSave")}
      </Button>
    </>
  );
}
