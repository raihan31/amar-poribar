"use client";

import "@/styles/entry.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CategoryGrid, PickerHeader } from "@/components/features/entry/CategoryGrid";
import { DraftReadBack } from "@/components/features/entry/DraftReadBack";
import { useDraftFlow } from "@/components/features/entry/useDraftFlow";
import { VoiceFallbackCard } from "@/components/features/entry/VoiceFallbackCard";
import { BackHeader } from "@/components/shell/BackHeader";
import { useFamily } from "@/components/shell/useFamily";
import { Banner } from "@/components/ui/Banner";
import { Icon } from "@/components/ui/icons";
import { useAccounts, useCategories } from "@/lib/api/hooks/useFamilyData";
import { bnLocative } from "@/lib/entry/quickParse";
import { useFormat } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import type { Account, Category } from "@/lib/types";

const TOAST_MS = 900;
const NONE: never[] = [];

/** A3 voice entry with read-back, A4 category picker and D8 fallback (FR-VOICE-01..03, -06, -07). */
export default function VoiceEntryPage() {
  const { family, role } = useFamily();
  const cats = useCategories(family.id);
  const accts = useAccounts(family.id);
  const categories = (cats.data ?? NONE) as unknown as Category[];
  const accounts = (accts.data ?? NONE) as unknown as Account[];
  return <VoiceEntry familyId={family.id} viewer={role === "viewer"} categories={categories} accounts={accounts} />;
}

function VoiceEntry(props: { familyId: string; viewer: boolean; categories: Category[]; accounts: Account[] }) {
  const { familyId, viewer, categories, accounts } = props;
  const t = useT();
  const router = useRouter();
  const { locale } = useI18n();
  const { name } = useFormat();
  const flow = useDraftFlow({ familyId, categories, accounts });
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const started = useRef(false);

  // "/add/voice?autostart=1" from Home starts listening at once.
  useEffect(() => {
    if (started.current || !flow.supported) return;
    if (new URLSearchParams(window.location.search).get("autostart") === "1") {
      started.current = true;
      flow.start();
    }
  }, [flow]);

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => router.push("/"), TOAST_MS);
    return () => clearTimeout(id);
  }, [saved, router]);

  const view = flow.view;
  const kind = view?.draft.type === "income" ? "income" : "expense";
  const gridCategories = categories.filter((c) => !c.isHidden && c.kind === kind);

  async function keep() {
    setSaveFailed(false);
    if (await flow.save()) setSaved(true);
    else setSaveFailed(true);
  }

  function typed(e: FormEvent) {
    e.preventDefault();
    void flow.submit(text, false);
  }

  const title =
    flow.status === "readback"
      ? t("entry.titleVoice")
      : flow.status === "needsCategory"
        ? t("entry.titlePicker")
        : t("home.speak");

  if (viewer) {
    return (
      <>
        <BackHeader title={t("home.speak")} />
        <main className="entry">
          <p>{t("role.readOnly")}</p>
        </main>
      </>
    );
  }

  const changeHref = view ? `/add?draft=${encodeURIComponent(JSON.stringify(view.draft))}` : "/add";
  const picked = view?.category ?? null;

  return (
    <>
      <BackHeader title={title} />
      <main className="entry">
        {saved && (
          <div className="entry-toast" role="status">
            {t("entry.saved")}
          </div>
        )}
        {saveFailed && <Banner tone="danger">{t("entry.saveFailed")}</Banner>}

        {view && flow.status === "readback" && (
          <DraftReadBack
            transcript={flow.transcript}
            view={view}
            onYes={keep}
            onNo={flow.discard}
            changeHref={changeHref}
            saving={flow.saving || saved}
          />
        )}

        {view && flow.status === "needsCategory" && (
          <>
            <PickerHeader view={view} />
            <h2 className="entry-whatfor">{t("entry.whatFor")}</h2>
            <p className="entry-hint">{t("entry.tapPicture")}</p>
            <CategoryGrid
              categories={gridCategories}
              selectedKey={view.draft.categoryKey}
              onSelect={flow.pickCategory}
            />
            <div className="entry-sticky">
              <button type="button" className="entry-save" disabled={!picked || flow.saving || saved} onClick={keep}>
                {picked
                  ? t("entry.keepIn", { where: locale === "bn" ? bnLocative(name(picked)) : name(picked) })
                  : t("entry.keepPick")}
              </button>
            </div>
          </>
        )}

        {!view && (
          <>
            <VoiceFallbackCard onText={(v) => void flow.submit(v, false)} />
            {flow.quota && (
              <Banner tone="warn">
                {t("entry.quota")} <Link href="/plans">{t("entry.seePlans")}</Link>
              </Banner>
            )}
            {flow.status === "error" && !flow.quota && <Banner tone="warn">{t("entry.notUnderstood")}</Banner>}
            {flow.speechError && <Banner tone="warn">{t("voiceUnsupported")}</Banner>}
            <button
              type="button"
              className="entry-mic"
              disabled={!flow.supported || flow.status === "parsing"}
              onClick={flow.status === "listening" ? flow.stop : flow.start}
            >
              <Icon name="mic" size={40} />
              {flow.status === "listening"
                ? t("listening")
                : flow.status === "parsing"
                  ? t("entry.parsing")
                  : t("tapToSpeak")}
            </button>
            <form className="entry-typed" onSubmit={typed}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("quickAddPlaceholder")}
                aria-label={t("quickAddPlaceholder")}
              />
              <button type="submit" disabled={!text.trim() || flow.status === "parsing"}>
                {t("parse")}
              </button>
            </form>
          </>
        )}
      </main>
    </>
  );
}
