"use client";

import { useCallback, useEffect, useState } from "react";
import { parseAmountToPaisa } from "@amar-poribar/shared";
import { api } from "@/lib/api/client";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { BudgetRow, Category, Family } from "@/lib/types";

/** Monthly budgets with spend, 80%/100% alerts and (for owners and admins) editing (FR-BUD-01..03). */
export function BudgetList(props: {
  family: Family;
  month: string;
  categories: Category[];
  /** Changes whenever spending changes, so budgets reload after a new entry. */
  spentKey: number;
  onError: (e: unknown) => void;
}) {
  const { family, month, categories, spentKey, onError } = props;
  const t = useT();
  const { money, name } = useFormat();
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const canEdit = family.role === "owner" || family.role === "admin";
  const OVERALL = "overall";

  const load = useCallback(() => {
    api<{ budgets: BudgetRow[] }>(`/v1/families/${family.id}/budgets?month=${month}`, {})
      .then((r) => setRows(r.budgets))
      .catch(onError);
  }, [family.id, month, onError]);
  useEffect(load, [load, spentKey]);

  function startEdit() {
    const d: Record<string, string> = {};
    for (const r of rows) d[r.categoryId ?? OVERALL] = String(r.limitPaisa / 100);
    setDraft(d);
    setEditing(true);
  }

  async function save() {
    // Blank clears a budget (limit 0); unreadable input is left alone rather than guessed.
    const budgets: { categoryId: string | null; limitPaisa: number }[] = [];
    const keys = new Set([...Object.keys(draft), ...rows.map((r) => r.categoryId ?? OVERALL)]);
    for (const key of keys) {
      const text = (draft[key] ?? "").trim();
      const limitPaisa = text === "" ? 0 : parseAmountToPaisa(text);
      if (limitPaisa === null) continue;
      const before = rows.find((r) => (r.categoryId ?? OVERALL) === key)?.limitPaisa ?? 0;
      if (limitPaisa !== before) budgets.push({ categoryId: key === OVERALL ? null : key, limitPaisa });
    }
    try {
      if (budgets.length) {
        await api(`/v1/families/${family.id}/budgets?month=${month}`, { method: "PUT", body: { budgets } });
      }
      setEditing(false);
      load();
    } catch (e) {
      onError(e);
    }
  }

  const expenseCats = categories.filter((c) => c.kind === "expense" && !(c as { isHidden?: boolean }).isHidden);
  const status = (l: BudgetRow["level"]) =>
    l === "exceeded" ? t("budgetExceeded") : l === "warning" ? t("budgetWarning") : null;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{t("budgets")}</strong>
        {canEdit && !editing && (
          <button className="secondary" onClick={startEdit}>
            {t("budgetSet")}
          </button>
        )}
      </div>
      {editing ? (
        <>
          {[
            { key: OVERALL, label: t("budgetOverall") },
            ...expenseCats.map((c) => ({ key: c.id, label: `${c.icon ?? ""} ${name(c)}` })),
          ].map((f) => (
            <label key={f.key} className="budget-edit">
              <span>{f.label}</span>
              <input
                inputMode="decimal"
                placeholder="৳"
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </label>
          ))}
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={save}>{t("budgetSave")}</button>
            <button className="secondary" onClick={() => setEditing(false)}>
              ✗
            </button>
          </div>
        </>
      ) : rows.length === 0 ? (
        <p className="muted">{t("budgetNone")}</p>
      ) : (
        <ul>
          {rows.map((r) => {
            const pct = Math.min(100, (r.spentPaisa / r.limitPaisa) * 100);
            return (
              <li key={r.categoryId ?? OVERALL} className="bar-row">
                <span className="bar-label">
                  <span>
                    {name(r)}
                    {r.inherited && <span className="muted"> · {t("budgetCarried")}</span>}
                  </span>
                  <span>
                    {money(r.spentPaisa)} / {money(r.limitPaisa)}
                  </span>
                </span>
                <span className={`bar ${r.level}`} aria-hidden="true">
                  <span style={{ width: `${pct}%` }} />
                </span>
                {status(r.level) && <span className={`budget-status ${r.level}`}>{status(r.level)}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
