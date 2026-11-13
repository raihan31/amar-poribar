"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";
import { splitAmounts } from "@/lib/format/amounts";
import { useT } from "@/lib/i18n/useT";
import { getRecognitionCtor } from "@/lib/speech/recognition";
import { useSpeak } from "@/lib/speech/useSpeak";
import { Icon } from "@/components/ui/icons";
import { HoldToTalk } from "./HoldToTalk";
import { SuggestedQuestions } from "./SuggestedQuestions";

interface Bubble {
  id: number;
  from: "user" | "ai";
  text: string;
}
type AskFailure = "plan" | "quota" | "other";

function failureOf(err: unknown): AskFailure {
  if (err instanceof ApiProblem) {
    if (err.code === "ai_quota") return "quota";
    if (err.code.startsWith("plan_")) return "plan";
  }
  return "other";
}

function Answer({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className="ask-answer-line">
          {splitAmounts(line).map((part, j) =>
            part.kind === "amount" ? <b key={j}>{part.value}</b> : <Fragment key={j}>{part.value}</Fragment>,
          )}
        </p>
      ))}
    </>
  );
}

/** B5: chat bubbles, suggested questions and the hold-to-talk mic. Spoken questions are answered aloud (FR-VOICE-08). */
export function AskThread({ familyId }: { familyId: string }) {
  const t = useT();
  const { speak } = useSpeak();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [failure, setFailure] = useState<AskFailure | null>(null);
  const [typeChosen, setTypeChosen] = useState(false);
  // Without speech recognition the text field is the only way in.
  const noSpeech = useSyncExternalStore(
    () => () => {},
    () => getRecognitionCtor() === null,
    () => false,
  );
  const typing = typeChosen || noSpeech;
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [bubbles, failure]);

  const ask = useMutation({
    mutationFn: ({ question, spoken }: { question: string; spoken: boolean }) =>
      api<{ answer: string }>(`/v1/families/${familyId}/ai/ask`, { body: { question, forSpeech: spoken } }),
  });

  function submit(question: string, spoken: boolean) {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setFailure(null);
    setBubbles((b) => [...b, { id: nextId.current++, from: "user", text: q }]);
    ask.mutate(
      { question: q, spoken },
      {
        onSuccess: ({ answer }) => {
          setBubbles((b) => [...b, { id: nextId.current++, from: "ai", text: answer }]);
          if (spoken) speak(answer, { interrupt: true });
        },
        onError: (err) => setFailure(failureOf(err)),
      },
    );
  }

  function typed(e: FormEvent) {
    e.preventDefault();
    const q = draft;
    setDraft("");
    submit(q, false);
  }

  return (
    <div className="ask-thread">
      <div className="ask-bubbles" aria-live="polite">
        {bubbles.map((b) =>
          b.from === "user" ? (
            <div key={b.id} className="ask-bubble ask-bubble--user">
              {b.text}
            </div>
          ) : (
            <div key={b.id} className="ask-bubble ask-bubble--ai">
              <Answer text={b.text} />
              <button type="button" className="ask-replay" onClick={() => speak(b.text, { interrupt: true })}>
                <Icon name="speaker" size={26} />
                {t("entry.listenAgain")}
              </button>
            </div>
          ),
        )}
        {ask.isPending && <p className="ask-thinking">{t("ask.thinking")}</p>}
        {failure === "other" && (
          <p role="alert" className="ask-error">
            {t("ask.failed")}
          </p>
        )}
        {(failure === "plan" || failure === "quota") && (
          <div role="alert" className="ask-limit">
            <p>{failure === "quota" ? t("ask.quota") : t("ask.plan")}</p>
            <Link href="/plans" className="ask-limit-link">
              {t("entry.seePlans")}
            </Link>
          </div>
        )}
        <div ref={end} />
      </div>

      <p className="ask-privacy">
        <Icon name="lock" size={18} />
        {t("ask.privacy")}
      </p>
      <SuggestedQuestions onPick={(q) => submit(q, false)} disabled={ask.isPending} />

      <div className="ask-controls">
        <HoldToTalk onText={(q) => submit(q, true)} disabled={ask.isPending} />
        {typing ? (
          <form className="ask-form" onSubmit={typed}>
            <input
              className="ask-input"
              aria-label={t("ask.typeLabel")}
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="ask-send" disabled={ask.isPending || !draft.trim()}>
              {t("ask.send")}
            </button>
          </form>
        ) : (
          <p className="ask-or">
            {t("ask.or")}{" "}
            <button type="button" className="ask-type-link" onClick={() => setTypeChosen(true)}>
              {t("ask.type")}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
