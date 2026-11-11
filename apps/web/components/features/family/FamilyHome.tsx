"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t, type MonthlyAiSummary, type MonthSummary } from "@amar-poribar/shared";
import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";
import type { Account, Category, Family } from "@/lib/types";
import { BudgetList } from "../budget/BudgetList";
import { QuickAdd } from "../entry/QuickAdd";
import { ManageLists } from "../ledger/ManageLists";
import { MonthSummaryCard } from "../reports/MonthSummaryCard";
import { SpokenSummary } from "../reports/SpokenSummary";
import { CreateFamilyForm } from "./CreateFamilyForm";
import { MemberList } from "./MemberList";

export function FamilyHome({ onLogout }: { onLogout: () => void }) {
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
  const [notice, setNotice] = useState<string | null>(null);

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
      api<MonthlyAiSummary>(`/v1/families/${fam.id}/ai/summary?locale=bn${q ? `&${q}` : ""}`, {}),
    ]);
    setCategories(cats);
    setAccounts(accs);
    setSummary(sum);
    setAiSummary(ai);
  }, []);

  useEffect(() => {
    (async () => {
      // An invite link looks like /?invite=TOKEN; accept it once the user is signed in.
      let joinedId: string | null = null;
      const inviteToken = new URLSearchParams(window.location.search).get("invite");
      if (inviteToken) {
        try {
          const res = await api<{ familyId: string }>(`/v1/invites/${encodeURIComponent(inviteToken)}/accept`, {
            method: "POST",
            body: {},
          });
          joinedId = res.familyId;
          setNotice(t("joined"));
        } catch (e) {
          setError((e as Error).message);
        }
        window.history.replaceState(null, "", window.location.pathname);
      }
      const me = await api<{ user: { id: string }; families: Family[] }>("/v1/me", {});
      setMeId(me.user.id);
      const fam = me.families.find((f) => f.id === joinedId) ?? me.families[0] ?? null;
      setFamily(fam);
      if (fam) await refresh(fam);
    })()
      .catch(handle)
      .finally(() => setLoaded(true));
  }, [refresh, handle]);

  if (!loaded) return <p className="muted">লোড হচ্ছে…</p>;
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
      {summary && (
        <BudgetList
          family={family}
          month={summary.month}
          categories={categories}
          spentKey={summary.expensePaisa}
          onError={handle}
        />
      )}
      {(family.role === "owner" || family.role === "admin") && (
        <ManageLists
          family={family}
          categories={categories}
          accounts={accounts}
          onChanged={() => refresh(family).catch(handle)}
          onError={handle}
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
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      <button className="secondary" onClick={onLogout}>
        লগআউট
      </button>
    </>
  );
}
