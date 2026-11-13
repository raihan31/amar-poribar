"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/icons";
import { api } from "@/lib/api/client";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { Category } from "@/lib/types";

interface MerchantRule {
  id: string;
  pattern: string;
  categoryId: string;
}

/** "যা যা মনে রেখেছি": what the app learned (FR-AI-07). Rules are per family. */
export function RuleList({
  familyId,
  categories,
  canEdit = true,
}: {
  familyId: string;
  categories: Category[];
  canEdit?: boolean;
}) {
  const t = useT();
  const { name } = useFormat();
  const qc = useQueryClient();
  const key = ["family", familyId, "merchant-rules"] as const;
  const rules = useQuery({
    queryKey: key,
    queryFn: () => api<MerchantRule[]>(`/v1/families/${familyId}/merchant-rules`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/v1/families/${familyId}/merchant-rules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const list = rules.data ?? [];
  const catName = (id: string) => {
    const c = categories.find((x) => x.id === id);
    return c ? name(c) : "";
  };

  return (
    <section className="txn-rules">
      <h2>{t("rule.title")}</h2>
      {rules.isSuccess && list.length === 0 && <p className="muted">{t("rule.empty")}</p>}
      <ul className="ledger-accounts">
        {list.map((r) => (
          <li key={r.id} className="ledger-account">
            <span className="ledger-account__main">
              {t("rule.row", { pattern: r.pattern, to: catName(r.categoryId) })}
            </span>
            {canEdit && (
              <button
                type="button"
                className="txn-rules__delete"
                aria-label={t("rule.delete")}
                onClick={() => remove.mutate(r.id)}
              >
                <Icon name="close" size={24} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="muted">{t("rule.note")}</p>
    </section>
  );
}
