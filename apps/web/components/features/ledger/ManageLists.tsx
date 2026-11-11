"use client";

import { useState } from "react";
import { ACCOUNT_TYPES, t } from "@amar-poribar/shared";
import { api } from "@/lib/api/client";
import type { Account, Category, Family } from "@/lib/types";

/** Add, rename, hide and archive accounts and categories (FR-ACC-01, FR-CAT-02). Owners and admins only. */
export function ManageLists(props: {
  family: Family;
  categories: Category[];
  accounts: Account[];
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const { family, categories, accounts, onChanged, onError } = props;
  const base = `/v1/families/${family.id}`;
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState<(typeof ACCOUNT_TYPES)[number]>("cash");
  const [cat, setCat] = useState({ kind: "expense", nameBn: "", nameEn: "", icon: "" });

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      onChanged();
    } catch (e) {
      onError(e);
    }
  }
  const rename = (path: string, field: string, value: string, current: string) =>
    value.trim() && value.trim() !== current
      ? run(() => api(path, { method: "PATCH", body: { [field]: value.trim() } }))
      : undefined;

  return (
    <details className="card">
      <summary>{t("manage")}</summary>

      <p className="muted" style={{ marginBottom: 0 }}>
        {t("accounts")}
      </p>
      {accounts.map((a) => (
        <div key={a.id} className="manage-row">
          <input
            defaultValue={a.name}
            aria-label={t("accountName")}
            onBlur={(e) => rename(`${base}/accounts/${a.id}`, "name", e.target.value, a.name)}
          />
          <button
            className="secondary"
            onClick={() => run(() => api(`${base}/accounts/${a.id}`, { method: "PATCH", body: { archived: true } }))}
          >
            {t("archive")}
          </button>
        </div>
      ))}
      <div className="add-row">
        <input placeholder={t("accountName")} value={accName} onChange={(e) => setAccName(e.target.value)} />
        <select value={accType} aria-label="type" onChange={(e) => setAccType(e.target.value as typeof accType)}>
          {ACCOUNT_TYPES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <button
          disabled={!accName.trim()}
          onClick={() =>
            run(async () => {
              await api(`${base}/accounts`, { body: { name: accName.trim(), type: accType } });
              setAccName("");
            })
          }
        >
          {t("add")}
        </button>
      </div>

      <p className="muted" style={{ marginBottom: 0, marginTop: 20 }}>
        {t("categories")}
      </p>
      {categories.map((c) => (
        <div key={c.id} className={`manage-row${c.isHidden ? " hidden-item" : ""}`}>
          <span className="row">
            <span aria-hidden="true">{c.icon}</span>
            <input
              defaultValue={c.nameBn}
              aria-label={t("nameBn")}
              onBlur={(e) => rename(`${base}/categories/${c.id}`, "nameBn", e.target.value, c.nameBn)}
            />
          </span>
          <button
            className="secondary"
            onClick={() =>
              run(() => api(`${base}/categories/${c.id}`, { method: "PATCH", body: { isHidden: !c.isHidden } }))
            }
          >
            {c.isHidden ? t("unhide") : t("hide")}
          </button>
        </div>
      ))}
      <div className="add-row">
        <select value={cat.kind} aria-label="kind" onChange={(e) => setCat({ ...cat, kind: e.target.value })}>
          <option value="expense">{t("expenseKind")}</option>
          <option value="income">{t("incomeKind")}</option>
        </select>
        <input
          placeholder={t("nameBn")}
          value={cat.nameBn}
          onChange={(e) => setCat({ ...cat, nameBn: e.target.value })}
        />
        <input
          placeholder={t("nameEn")}
          value={cat.nameEn}
          onChange={(e) => setCat({ ...cat, nameEn: e.target.value })}
        />
        <input
          placeholder="🙂"
          maxLength={4}
          value={cat.icon}
          onChange={(e) => setCat({ ...cat, icon: e.target.value })}
          style={{ flex: "0 1 70px" }}
        />
        <button
          disabled={!cat.nameBn.trim() || !cat.nameEn.trim()}
          onClick={() =>
            run(async () => {
              await api(`${base}/categories`, {
                body: {
                  kind: cat.kind,
                  nameBn: cat.nameBn.trim(),
                  nameEn: cat.nameEn.trim(),
                  ...(cat.icon ? { icon: cat.icon } : {}),
                },
              });
              setCat({ kind: cat.kind, nameBn: "", nameEn: "", icon: "" });
            })
          }
        >
          {t("add")}
        </button>
      </div>
    </details>
  );
}
