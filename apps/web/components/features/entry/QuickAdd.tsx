"use client";

import { useState } from "react";
import { draftToSpeech, formatBDT, t, type ParseResponse, type TransactionDraft } from "@amar-poribar/shared";
import { api } from "@/lib/api/client";
import { speak, stopSpeaking, useSpeechRecognition } from "@/lib/voice";
import type { Account, Category, Family } from "@/lib/types";
import { CategoryPicker } from "./CategoryPicker";

export function QuickAdd(props: {
  family: Family;
  categories: Category[];
  accounts: Account[];
  onSaved: () => void;
  onError: (e: unknown) => void;
}) {
  const { family, categories, accounts, onSaved, onError } = props;
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<TransactionDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const voice = useSpeechRecognition("bn-BD");

  const categoryOf = (key: string | null) => categories.find((x) => x.key === key) ?? null;

  /** Read the first draft back so the user can check it by ear (FR-VOICE-03). */
  function readBack(list: TransactionDraft[]) {
    const first = list[0];
    if (first) speak(draftToSpeech(first, categoryOf(first.categoryKey)?.nameBn ?? null));
    else speak(t("noDrafts"));
  }

  async function parse(input = text, spoken = false) {
    setBusy(true);
    try {
      const res = await api<ParseResponse>(`/v1/families/${family.id}/ai/parse`, {
        body: { text: input, now: new Date().toISOString() },
      });
      // Voice entries come back marked as voice, so reports can tell them apart.
      const list = spoken ? res.drafts.map((d) => ({ ...d, source: "voice" as const })) : res.drafts;
      setDrafts(list);
      if (spoken) readBack(list);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    stopSpeaking();
    voice.start((heard) => {
      setText(heard);
      void parse(heard, true);
    });
  }

  async function confirm(d: TransactionDraft, i: number) {
    try {
      await api(`/v1/families/${family.id}/transactions`, {
        body: {
          type: d.type,
          amountPaisa: d.amountPaisa,
          feePaisa: d.feePaisa,
          occurredAt: d.occurredAt,
          categoryId: categories.find((c) => c.key === d.categoryKey)?.id ?? null,
          accountId: accounts.find((a) => a.type === d.accountType)?.id ?? null,
          note: d.note,
          counterparty: d.counterparty ?? undefined,
          trxId: d.trxId ?? undefined,
          source: d.source,
          aiConfidence: d.confidence,
        },
      });
      setDrafts((prev) => {
        const rest = prev?.filter((_, j) => j !== i) ?? [];
        return rest.length ? rest : null;
      });
      setText("");
      onSaved();
    } catch (e) {
      onError(e);
    }
  }

  const categoryName = (key: string | null) => {
    const c = categories.find((x) => x.key === key);
    return c ? `${c.icon ?? ""} ${c.nameBn}` : "ক্যাটাগরি বাছাই করুন";
  };

  return (
    <div className="card">
      <button
        className="mic"
        onClick={voice.listening ? voice.stop : listen}
        disabled={!voice.supported || busy}
        aria-label={t("tapToSpeak")}
      >
        <span aria-hidden="true">🎤</span> {voice.listening ? t("listening") : t("tapToSpeak")}
      </button>
      {!voice.supported && <p className="muted">{t("voiceUnsupported")}</p>}
      {voice.error && <p className="error">{voice.error}</p>}
      <textarea
        rows={3}
        placeholder={t("quickAddPlaceholder")}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={() => parse()} disabled={busy || !text.trim()}>
          {busy ? "…" : t("parse")}
        </button>
      </div>
      {drafts && drafts.length === 0 && <p className="muted">{t("noDrafts")}</p>}
      {drafts && drafts.length > 0 && (
        <ul style={{ marginTop: 12 }}>
          {drafts.map((d, i) => (
            <li key={i} className="draft">
              <span className="draft-text">
                <span className="draft-icon" aria-hidden="true">
                  {categoryOf(d.categoryKey)?.icon ?? "📦"}
                </span>
                <span>
                  <strong>{formatBDT(d.amountPaisa, { bnDigits: true })}</strong>
                  <br />
                  <span className="muted">
                    {categoryName(d.categoryKey)} · {d.note}
                  </span>
                </span>
              </span>
              {!d.categoryKey && (
                <CategoryPicker
                  categories={categories.filter(
                    (c) => !c.isHidden && c.kind === (d.type === "income" ? "income" : "expense"),
                  )}
                  onPick={(key) =>
                    setDrafts((prev) => prev?.map((x, j) => (j === i ? { ...x, categoryKey: key } : x)) ?? null)
                  }
                />
              )}
              <span className="row">
                <button
                  className="icon secondary"
                  aria-label={t("speak")}
                  onClick={() => speak(draftToSpeech(d, categoryOf(d.categoryKey)?.nameBn ?? null))}
                >
                  🔊
                </button>
                <button
                  className="icon danger"
                  aria-label={t("no")}
                  onClick={() =>
                    setDrafts((prev) => {
                      const rest = prev?.filter((_, j) => j !== i) ?? [];
                      return rest.length ? rest : null;
                    })
                  }
                >
                  ✗
                </button>
                <button className="icon" aria-label={t("yes")} onClick={() => confirm(d, i)}>
                  ✓
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
