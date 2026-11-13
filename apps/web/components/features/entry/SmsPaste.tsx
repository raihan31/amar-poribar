"use client";

import { useEffect, useRef, useState } from "react";
import type { ParseResponse } from "@amar-poribar/shared";
import { Banner } from "@/components/ui/Banner";
import { Icon } from "@/components/ui/icons";
import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";
import { useT } from "@/lib/i18n/useT";
import type { Account, Category } from "@/lib/types";
import { SmsPreview } from "./SmsPreview";

const DEBOUNCE_MS = 400;

/** Parse response with the A5 fields (`via`, `isDuplicate`); both are optional on older servers. */
type SmsParse = ParseResponse & { via?: "template" | "quick" | "rule" | "llm"; isDuplicate?: boolean };

export interface SmsPasteProps {
  familyId: string;
  categories: Category[];
  accounts: Account[];
  onSaved: () => void;
  onDiscard?: () => void;
}

/** A5: paste a bKash/Nagad/Rocket SMS, see what we understood, then keep it (FR-AI-02, FR-TXN-04). */
export function SmsPaste({ familyId, categories, accounts, onSaved, onDiscard }: SmsPasteProps) {
  const t = useT();
  const [text, setText] = useState("");
  const [result, setResult] = useState<SmsParse | null>(null);
  const [failed, setFailed] = useState(false);
  const [dupSaved, setDupSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const seq = useRef(0);

  // Debounced parse on every change of the pasted text.
  useEffect(() => {
    const input = text.trim();
    const mine = ++seq.current;
    setChosen(null);
    setDupSaved(false);
    setSaveFailed(false);
    if (!input) {
      setResult(null);
      setFailed(false);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await api<SmsParse>(`/v1/families/${familyId}/ai/parse`, {
          body: { text: input, now: new Date().toISOString() },
        });
        if (mine !== seq.current) return;
        setResult(res);
        setFailed(res.drafts.length === 0);
      } catch {
        if (mine !== seq.current) return;
        setResult(null);
        setFailed(true);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text, familyId]);

  async function pasteFromClipboard() {
    try {
      const clip = await navigator.clipboard?.readText();
      if (clip) setText(clip);
    } catch {
      // Permission refused: the user can still paste into the box by hand.
    }
  }

  const draft = result?.drafts[0] ?? null;
  const duplicate = dupSaved || result?.isDuplicate === true;
  const expenseCats = categories.filter(
    (c) => !c.isHidden && c.kind === (draft?.type === "income" ? "income" : "expense"),
  );
  const guess = draft?.categoryKey ? expenseCats.find((c) => c.key === draft.categoryKey) : undefined;
  const suggestions = [guess, ...expenseCats.filter((c) => c.key !== "other" && c.key !== guess?.key)]
    .filter((c): c is Category => Boolean(c))
    .slice(0, 3);
  const picked = chosen ?? draft?.categoryKey ?? null;

  async function keep() {
    if (!draft || duplicate) return;
    setSaving(true);
    setSaveFailed(false);
    const category = categories.find((c) => c.key === picked);
    try {
      await api(`/v1/families/${familyId}/transactions`, {
        idempotent: true,
        body: {
          type: draft.type,
          amountPaisa: draft.amountPaisa,
          feePaisa: draft.feePaisa,
          occurredAt: draft.occurredAt,
          categoryId: category?.id ?? null,
          accountId: accounts.find((a) => a.type === draft.accountType)?.id ?? null,
          note: draft.note,
          counterparty: draft.counterparty ?? undefined,
          trxId: draft.trxId ?? undefined,
          source: draft.source,
          aiConfidence: draft.confidence,
        },
      });
      onSaved();
    } catch (e) {
      if (e instanceof ApiProblem && e.code === "duplicate_trx_id") setDupSaved(true);
      else setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setText("");
    onDiscard?.();
  }

  return (
    <div className="sms">
      <h1 className="sms-title">{t("sms.title")}</h1>
      <p className="sms-sub">{t("sms.sub")}</p>
      <textarea
        className="sms-box"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("sms.placeholder")}
        aria-label={t("sms.placeholder")}
      />
      <button type="button" className="sms-paste" onClick={pasteFromClipboard}>
        <Icon name="list" size={22} />
        {t("sms.paste")}
      </button>

      {failed && <Banner tone="warn">{t("entry.notUnderstood")}</Banner>}
      {saveFailed && <Banner tone="danger">{t("entry.saveFailed")}</Banner>}

      {draft && (
        <SmsPreview
          draft={draft}
          via={result?.via ?? (result?.usedAi ? "llm" : "rule")}
          duplicate={duplicate}
          suggestions={suggestions}
          picked={picked}
          onPick={setChosen}
        />
      )}

      <div className="sms-spacer" />
      <div className="sms-answers">
        <button type="button" className="sms-no" onClick={discard}>
          {t("sms.no")}
        </button>
        <button type="button" className="sms-yes" disabled={!draft || duplicate || saving || !picked} onClick={keep}>
          ✓ {t("sms.keep")}
        </button>
      </div>
    </div>
  );
}
