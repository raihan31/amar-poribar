"use client";

import "@/styles/ledger.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TransactionListItem } from "@amar-poribar/shared";
import { PageHeader } from "@/components/shell/PageHeader";
import { useFamily } from "@/components/shell/useFamily";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAccounts, useMembers } from "@/lib/api/hooks/useFamilyData";
import { useTransactions } from "@/lib/api/hooks/useTransactions";
import { currentMonth, dhakaDay } from "@/lib/format/month";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { Account, Member } from "@/lib/types";
import { FilterChips } from "./FilterChips";
import { MonthSwitcher } from "./MonthSwitcher";
import { TransactionRow } from "./TransactionRow";

interface UrlFilters {
  member?: string | undefined;
  account?: string | undefined;
  category?: string | undefined;
}

function readUrl(): UrlFilters {
  const p = new URLSearchParams(window.location.search);
  return {
    member: p.get("member") ?? undefined,
    account: p.get("account") ?? undefined,
    category: p.get("category") ?? undefined,
  };
}

function writeUrl(f: UrlFilters) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const qs = p.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

/** B1: the month's entries, filtered by member and account, loaded 50 at a time (FR-TXN-02). */
export function TransactionList() {
  const t = useT();
  const { date } = useFormat();
  const { family, role } = useFamily();
  const [month, setMonth] = useState(() => currentMonth());
  // Filters live in the URL (`?member=&account=&category=`); read them once on first render.
  const [filters, setFilters] = useState<UrlFilters>(() => (typeof window === "undefined" ? {} : readUrl()));
  const [now] = useState(() => Date.now());
  const change = useCallback((patch: UrlFilters) => {
    setFilters((cur) => {
      const next = { ...cur, ...patch };
      writeUrl(next);
      return next;
    });
  }, []);

  const members = useMembers(family.id);
  const accounts = useAccounts(family.id);
  const q = useTransactions(family.id, {
    month,
    memberId: filters.member,
    accountId: filters.account,
    categoryId: filters.category,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const rows = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.items), [q.data]);
  const groups = useMemo(() => {
    const out: Array<{ day: string; items: TransactionListItem[] }> = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && last.day === r.dayKey) last.items.push(r);
      else out.push({ day: r.dayKey, items: [r] });
    }
    return out;
  }, [rows]);

  const today = dhakaDay(now);
  const yesterday = dhakaDay(now - 86_400_000);
  const dayLabel = (d: string) =>
    d === today ? t("entry.today") : d === yesterday ? t("entry.yesterday") : date(`${d}T12:00:00+06:00`, "short");

  const memberOpts = ((members.data ?? []) as unknown as Member[]).map((m) => ({
    id: m.userId,
    label: m.name ?? m.phone,
  }));
  const accountOpts = ((accounts.data ?? []) as unknown as Account[]).map((a) => ({ id: a.id, label: a.name }));
  const canWrite = role !== "viewer";
  const empty = q.isSuccess && rows.length === 0;
  const add = (
    <Link href="/add" className="ui-btn ui-btn--primary txn-add" style={{ minHeight: 56 }}>
      {t("txn.add")}
    </Link>
  );

  return (
    <>
      <PageHeader title={t("txn.title")} />
      <main className="ledger-page txn-page">
        <Button
          variant="secondary"
          className="txn-csv"
          onClick={() => {
            window.location.assign(`/api/proxy/v1/families/${family.id}/reports/export.csv?month=${month}`);
          }}
        >
          {t("txn.csv")}
        </Button>
        <MonthSwitcher month={month} onChange={setMonth} />
        <FilterChips
          members={memberOpts}
          accounts={accountOpts}
          memberId={filters.member}
          accountId={filters.account}
          onMember={(id) => change({ member: id })}
          onAccount={(id) => change({ account: id })}
        />
        {q.isError && <Banner tone="danger">{t("txn.failed")}</Banner>}
        {empty && (
          <EmptyState icon="receipt" title={t("txn.empty")}>
            {canWrite && add}
          </EmptyState>
        )}
        {groups.map((g) => (
          <section key={g.day}>
            <h2 className="txn-day">{dayLabel(g.day)}</h2>
            <ul className="txn-rows">
              {g.items.map((r) => (
                <TransactionRow key={r.id} item={r} />
              ))}
            </ul>
          </section>
        ))}
        {hasNextPage && (
          <>
            <div ref={sentinel} aria-hidden="true" />
            <Button variant="secondary" size="lg" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
              {t("txn.more")}
            </Button>
          </>
        )}
      </main>
      <div className="txn-sticky">
        {canWrite ? !empty && add : <p className="txn-readonly">{t("role.readOnly")}</p>}
      </div>
    </>
  );
}
