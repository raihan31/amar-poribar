"use client";

import "@/styles/home.css";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ActionTiles } from "@/components/features/home/ActionTiles";
import { ActivityFeed } from "@/components/features/home/ActivityFeed";
import { BudgetStrip } from "@/components/features/home/BudgetStrip";
import { FamilyRow } from "@/components/features/home/FamilyRow";
import { GreetingHeader } from "@/components/features/home/GreetingHeader";
import { HomeSimple } from "@/components/features/home/HomeSimple";
import { MonthCard } from "@/components/features/home/MonthCard";
import { SpeakButton } from "@/components/features/home/SpeakButton";
import { useFamily } from "@/components/shell/useFamily";
import {
  useActivity,
  useAiSummary,
  useBudgetRows,
  useFamilyMembers,
  useMonthSummary,
  usePresence,
} from "@/lib/home/useHomeData";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";

/** Home (Main): month, budget alert, speak button, tiles, family and latest activity (FR-HOME-01). */
export default function HomePage() {
  const t = useT();
  const router = useRouter();
  const { simple, locale } = useI18n();
  const { family, role, me } = useFamily();
  const meId = me?.id;
  const meName = typeof me?.name === "string" ? me.name : "";
  const viewer = role === "viewer";

  // Legacy invite links (/?invite=T) lead to the same flow as /join/T.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (token) router.replace(`/join/${encodeURIComponent(token)}`);
  }, [router]);

  const summary = useMonthSummary(family.id);
  const ai = useAiSummary(family.id, locale);
  const budgets = useBudgetRows(family.id);
  const members = useFamilyMembers(family.id);
  const presence = usePresence(family.id);
  const activity = useActivity(family.id);

  const online = useMemo(
    () => new Set((presence.data ?? []).filter((p) => p.online).map((p) => p.userId)),
    [presence.data],
  );
  // The member to tell about a budget alert: an admin first, else the owner, never oneself.
  const tell = useMemo(() => {
    const others = (members.data ?? []).filter((m) => m.userId !== meId);
    const target = others.find((m) => m.role === "admin") ?? others.find((m) => m.role === "owner");
    return target ? { id: target.userId, name: target.name ?? target.phone } : null;
  }, [members.data, meId]);

  if (simple) {
    return <HomeSimple familyName={family.name} speechText={ai.data?.speechText} canWrite={!viewer} />;
  }

  return (
    <main className="home">
      <GreetingHeader name={meName} familyName={family.name} />
      {summary.data && <MonthCard summary={summary.data} speechText={ai.data?.speechText} />}
      <BudgetStrip rows={budgets.data ?? []} tell={tell} canTell={!viewer} />
      {viewer ? <p className="home-readonly">{t("role.readOnly")}</p> : <SpeakButton />}
      <ActionTiles />
      <FamilyRow members={members.data ?? []} online={online} />
      <ActivityFeed items={activity.data ?? []} />
    </main>
  );
}
