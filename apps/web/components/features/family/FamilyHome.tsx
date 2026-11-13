"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type MonthlyAiSummary, type MonthSummary } from "@amar-poribar/shared";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/useT";
import { useI18n } from "@/lib/i18n/provider";
import { ApiProblem } from "@/lib/api/errors";
import type { Account, Category, Family } from "@/lib/types";
import { QuickAdd } from "../entry/QuickAdd";
import { MonthSummaryCard } from "../reports/MonthSummaryCard";
import { SpokenSummary } from "../reports/SpokenSummary";
import { CreateFamilyForm } from "./CreateFamilyForm";
import { MemberList } from "./MemberList";

export function FamilyHome({ onLogout }: { onLogout: () => void }) {
  const t = useT();
  const { locale } = useI18n();
  const [family, setFamily] = useState<Family | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [aiSummary, setAiSummary] = useState<MonthlyAiSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Selected month lives in a ref so changing it does not re-run the initial load below.
  const monthRef = useRef<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  const handle = useCallback(
    (e: unknown) => {
      if (e instanceof ApiProblem && e.status === 401) onLogout();
      else setError((e as Error).message);
    },
    [onLogout],
  );

  const refresh = useCallback(async (fam: Family, m: string | null = monthRef.current) => {
    const q = m ? `month=${m}` : "";
    const [cats, accs, sum, ai] = await Promise.all([
      api<Category[]>(`/v1/families/${fam.id}/categories`, {}),
      api<Account[]>(`/v1/families/${fam.id}/accounts`, {}),
      api<MonthSummary>(`/v1/families/${fam.id}/reports/summary?${q}`, {}),
      api<MonthlyAiSummary>(`/v1/families/${fam.id}/ai/summary?locale=${locale}${q ? `&${q}` : ""}`, {}),
    ]);
    setCategories(cats);
    setAccounts(accs);
    setSummary(sum);
    setAiSummary(ai);
  }, []);

  useEffect(() => {
    (async () => {
      // Invite links are handled by /join/[token]; the legacy /?invite=T redirects there.
      const me = await api<{ user: { id: string }; families: Family[] }>("/v1/me", {});
      setMeId(me.user.id);
      const fam = me.families[0] ?? null;
      setFamily(fam);
      if (fam) await refresh(fam);
    })()
      .catch(handle)
      .finally(() => setLoaded(true));
  }, [refresh, handle]);

  if (!loaded) return <p className="muted">{t("common.loading")}</p>;
  if (!family)
    return (
      <CreateFamilyForm
        onCreated={(f) => {
          setFamily(f);
          refresh(f).catch(handle);
        }}
      />
    );

  return (
    <>
      <QuickAdd
        family={family}
        categories={categories}
        accounts={accounts}
        onSaved={() => refresh(family).catch(handle)}
        onError={handle}
      />
      {aiSummary && <SpokenSummary summary={aiSummary} />}
      {summary && (
        <MonthSummaryCard
          summary={summary}
          onMonth={(m) => {
            monthRef.current = m;
            refresh(family, m).catch(handle);
          }}
        />
      )}
      {meId && (
        <MemberList
          family={family}
          meId={meId}
          onError={handle}
          onLeft={() => {
            setFamily(null);
            setLoaded(false);
            window.location.reload();
          }}
        />
      )}
      {error && <p className="error">{error}</p>}
      <button className="secondary" onClick={onLogout}>
        {t("common.logout")}
      </button>
    </>
  );
}
