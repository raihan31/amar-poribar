"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ParseResponse } from "@amar-poribar/shared";
import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";
import { qk } from "@/lib/api/queryKeys";
import { toDraftViews, type DraftView } from "@/lib/entry/quickParse";
import { stopSpeaking } from "@/lib/speech/synthesis";
import { useSpeechRecognition } from "@/lib/speech/useSpeechRecognition";
import type { Account, Category } from "@/lib/types";

export type DraftStatus = "idle" | "listening" | "parsing" | "readback" | "needsCategory" | "error";

/**
 * Voice entry state machine: idle, listening, parsing, then readback or needsCategory (or error).
 * Speech is parsed on the server; this hook only drives the screens (FR-VOICE-01, AC-02, AC-09).
 */
export function useDraftFlow(opts: { familyId: string; categories: Category[]; accounts: Account[] }) {
  const { familyId, categories, accounts } = opts;
  const qc = useQueryClient();
  const voice = useSpeechRecognition("bn-BD");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<DraftView | null>(null);
  const [transcript, setTranscript] = useState("");
  const [failed, setFailed] = useState(false);
  const [quota, setQuota] = useState(false);

  const status: DraftStatus = parsing
    ? "parsing"
    : view
      ? view.needsCategory
        ? "needsCategory"
        : "readback"
      : failed
        ? "error"
        : voice.listening
          ? "listening"
          : "idle";

  /** Sends text to the server parser. `spoken` marks the drafts `source:"voice"`. */
  const submit = useCallback(
    async (text: string, spoken = false) => {
      const input = text.trim();
      if (!input) return;
      setTranscript(input);
      setParsing(true);
      setFailed(false);
      setQuota(false);
      setView(null);
      try {
        const res = await api<ParseResponse>(`/v1/families/${familyId}/ai/parse`, {
          body: { text: input, now: new Date().toISOString() },
        });
        const first = toDraftViews(res, categories, spoken)[0];
        if (first) setView(first);
        else setFailed(true);
      } catch (e) {
        setFailed(true);
        // 429 ai_quota: tell the user, keep typing usable (E7).
        setQuota(e instanceof ApiProblem && e.code === "ai_quota");
      } finally {
        setParsing(false);
      }
    },
    [familyId, categories],
  );

  const start = useCallback(() => {
    stopSpeaking();
    setFailed(false);
    voice.start((heard) => void submit(heard, true));
  }, [voice, submit]);

  /** Picks a category on the A4 grid; the draft stays on that screen until saved. */
  const pickCategory = useCallback(
    (key: string) =>
      setView((v) =>
        v
          ? { ...v, draft: { ...v.draft, categoryKey: key }, category: categories.find((c) => c.key === key) ?? null }
          : v,
      ),
    [categories],
  );

  const discard = useCallback(() => {
    setView(null);
    setFailed(false);
    setQuota(false);
    setTranscript("");
  }, []);

  /** Saves the draft; resolves true on success. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!view) return false;
    const d = view.draft;
    setSaving(true);
    try {
      await api(`/v1/families/${familyId}/transactions`, {
        idempotent: true,
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
      await qc.invalidateQueries({ queryKey: qk.family(familyId).summary() });
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [view, familyId, categories, accounts, qc]);

  return {
    status,
    transcript,
    view,
    quota,
    saving,
    supported: voice.supported,
    speechError: voice.error,
    start,
    stop: voice.stop,
    submit,
    pickCategory,
    discard,
    save,
  };
}
