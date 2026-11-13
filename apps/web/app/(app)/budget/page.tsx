"use client";

import "@/styles/budget.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";
import { currentMonth, monthLabel } from "@/lib/format/month";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import { useSpeak } from "@/lib/speech/useSpeak";
import type { BudgetRow, Category, Member } from "@/lib/types";
import { BudgetCard } from "@/components/features/budget/BudgetCard";
import { WARN_PERCENT } from "@/components/features/budget/BudgetStatus";
import { BudgetEditSheet } from "@/components/features/budget/BudgetEditSheet";
import { useFamily } from "@/components/shell/useFamily";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

interface FestivalBudget {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  limitPaisa: number;
}

/** B3: monthly budgets with alerts and "tell someone" (FR-BUD-01, -02, -06, -07). */
export default function BudgetPage() {
  const t = useT();
  const { money, num, date, tag, name } = useFormat();
  const qc = useQueryClient();
  const { family, role, me } = useFamily();
  const { speak, stop, speaking } = useSpeak();
  const [month] = useState(() => currentMonth());
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);
  const base = `/v1/families/${family.id}`;
  const canEdit = role === "owner" || role === "admin";

  const budgets = useQuery({
    queryKey: qk.family(family.id).budgets(month),
    queryFn: async () => (await api<{ budgets: BudgetRow[] }>(`${base}/budgets?month=${month}`)).budgets,
  });
  const members = useQuery({
    queryKey: qk.family(family.id).members(),
    queryFn: () => api<Member[]>(`${base}/members`),
  });
  const categories = useQuery({
    queryKey: qk.family(family.id).categories(),
    queryFn: () => api<Category[]>(`${base}/categories`),
    enabled: canEdit,
  });
  const festivals = useQuery({
    queryKey: [...qk.family(family.id).all, "festival-budgets"],
    queryFn: () => api<FestivalBudget[]>(`${base}/festival-budgets`),
  });

  const rows = budgets.data ?? [];
  const meId = me?.id;
  // The person to tell: an admin first, else the owner, never oneself.
  const tell = useMemo(() => {
    const others = (members.data ?? []).filter((m) => m.userId !== meId);
    const target = others.find((m) => m.role === "admin") ?? others.find((m) => m.role === "owner");
    return target ? { id: target.userId, name: target.name ?? target.phone } : null;
  }, [members.data, meId]);

  function statusWord(r: BudgetRow): string {
    if (r.level === "exceeded") return t("bud.over", { amount: money(Math.max(0, r.spentPaisa - r.limitPaisa)) });
    if (r.level === "warning") return t("bud.warn", { pct: num(WARN_PERCENT) });
    return t("bud.ok");
  }

  function readAloud() {
    if (speaking) {
      stop();
      return;
    }
    const text = rows.length
      ? rows
          .map((r) =>
            t("bud.say", {
              name: name(r),
              spent: money(r.spentPaisa),
              limit: money(r.limitPaisa),
              status: statusWord(r),
            }),
          )
          .join(" ")
      : t("budgetNone");
    speak(text, { interrupt: true });
  }

  const inherited = rows.some((r) => r.inherited);
  const label = monthLabel(month, tag);
  const day = (d: string) => date(`${d}T12:00:00+06:00`, "short");

  return (
    <main className="bud-page">
      <h1 className="bud-title">{t("bud.title")}</h1>
      <p className="bud-sub">{inherited ? t("bud.carried", { month: label }) : label}</p>
      {(failed || budgets.isError) && <Banner tone="danger">{t("bud.saveFailed")}</Banner>}
      {rows.length === 0 && budgets.isSuccess && <p className="bud-sub">{t("budgetNone")}</p>}
      <ul className="bud-list">
        {rows.map((r) => (
          <BudgetCard key={r.categoryId ?? "overall"} row={r} tell={tell} canTell={role !== "viewer"} />
        ))}
        {(festivals.data ?? []).map((f) => (
          <li key={f.id}>
            <Link href="/festival/new" className="bud-card bud-card--festival">
              <strong>{t("bud.festival", { name: f.name })}</strong>
              <span>
                {day(f.startsOn)} – {day(f.endsOn)} · {money(f.limitPaisa)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="bud-footer">
        {canEdit ? (
          <Button size="xl" onClick={() => setEditing(true)}>
            {t("bud.add")}
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="buzz"
          size="xl"
          className="bud-speak"
          aria-label={speaking ? t("stop") : t("speak")}
          onClick={readAloud}
        >
          <Icon name="speaker" size={30} />
        </Button>
      </div>
      <BudgetEditSheet
        open={editing}
        onClose={() => setEditing(false)}
        familyId={family.id}
        month={month}
        role={role}
        rows={rows}
        categories={categories.data ?? []}
        onSaved={() => {
          setFailed(false);
          void qc.invalidateQueries({ queryKey: qk.family(family.id).all });
        }}
        onError={() => setFailed(true)}
      />
    </main>
  );
}
