"use client";

import "@/styles/ledger.css";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CategoryEditSheet, type CategoryChange } from "@/components/features/ledger/CategoryEditSheet";
import { RuleList } from "@/components/features/ledger/RuleList";
import { CategoryTile } from "@/components/features/ledger/CategoryTile";
import { PageHeader } from "@/components/shell/PageHeader";
import { ROLE_RANK, useFamily } from "@/components/shell/useFamily";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { api } from "@/lib/api/client";
import { useCategories } from "@/lib/api/hooks/useFamilyData";
import { qk } from "@/lib/api/queryKeys";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { Category } from "@/lib/types";

type Kind = "expense" | "income";

/** E2: category grid for expense and income; owners and admins edit (FR-CAT-01..03). */
export default function CategoriesPage() {
  const t = useT();
  const { name } = useFormat();
  const qc = useQueryClient();
  const { family, role } = useFamily();
  const canEdit = ROLE_RANK[role] >= ROLE_RANK.admin;
  const base = `/v1/families/${family.id}`;
  const cats = useCategories(family.id);
  const [kind, setKind] = useState<Kind>("expense");
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<{ category: Category | null } | null>(null);
  const [failed, setFailed] = useState(false);

  const all = (cats.data ?? []) as unknown as Category[];
  const shown = all.filter((c) => c.kind === kind);
  const incomeNames = all.filter((c) => c.kind === "income" && !c.isHidden).map((c) => name(c));

  async function save(change: CategoryChange) {
    const target = sheet?.category;
    setFailed(false);
    try {
      if (target) await api(`${base}/categories/${target.id}`, { method: "PATCH", body: change });
      else await api(`${base}/categories`, { method: "POST", body: change });
      setSheet(null);
      await qc.invalidateQueries({ queryKey: qk.family(family.id).all });
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <PageHeader title={t("cat.title")} />
      <main className="ledger-page">
        <SegmentedControl
          label={t("cat.tabs")}
          value={kind}
          onChange={setKind}
          options={[
            { value: "expense", label: t("expenseKind") },
            { value: "income", label: t("incomeKind") },
          ]}
        />
        {canEdit && <p className="muted">{t("cat.hint")}</p>}
        {failed && <Banner tone="danger">{t("fam.error")}</Banner>}
        {shown.length === 0 && cats.isSuccess && <p className="muted">{t("cat.empty")}</p>}
        <ul className="ledger-grid">
          {shown.map((c) => (
            <CategoryTile
              key={c.id}
              category={c}
              canEdit={canEdit}
              editing={editing}
              onEdit={(x) => setSheet({ category: x })}
            />
          ))}
        </ul>
        {kind === "expense" && incomeNames.length > 0 && (
          <section>
            <h2>{t("cat.incomeList")}</h2>
            <p>{incomeNames.join(" · ")}</p>
          </section>
        )}
        {canEdit && (
          <div className="ledger-actions">
            <Button size="lg" onClick={() => setSheet({ category: null })}>
              {t("cat.new")}
            </Button>
            <Button size="lg" variant="secondary" aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
              {t("cat.rename")}
            </Button>
          </div>
        )}
        <RuleList familyId={family.id} categories={all} canEdit={canEdit} />
      </main>
      {sheet && (
        <CategoryEditSheet open category={sheet.category} kind={kind} onSave={save} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
