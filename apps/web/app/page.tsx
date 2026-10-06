"use client";

import { useCallback, useEffect, useState } from "react";
import {
  draftToSpeech,
  formatBDT,
  t,
  type MonthlyAiSummary,
  type MonthSummary,
  type ParseResponse,
  type TransactionDraft,
} from "@amar-poribar/shared";
import { api, ApiError } from "../lib/api";
import { speak, stopSpeaking, useSpeechRecognition } from "../lib/voice";

interface Family { id: string; name: string; role: string }
interface Category { id: string; key: string; kind: string; nameBn: string; nameEn: string; icon: string | null }
interface Account { id: string; name: string; type: string }

const TOKEN_KEY = "amar-poribar.token";

function loadToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function saveToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => setToken(loadToken()), []);

  const onLogin = (tok: string) => { saveToken(tok); setToken(tok); };
  const onLogout = () => { saveToken(null); setToken(null); };

  return (
    <main>
      <h1>{t("appName")} <span className="muted">· Amar Poribar</span></h1>
      {token ? <FamilyHome token={token} onLogout={onLogout} /> : <Login onLogin={onLogin} />}
    </main>
  );
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setError(null);
    try {
      const res = await api<{ devCode?: string }>("/v1/auth/otp/request", { body: { phone } });
      setSent(true);
      setHint(res.devCode ? `Dev OTP: ${res.devCode}` : null);
    } catch (e) { setError((e as Error).message); }
  }

  async function verify() {
    setError(null);
    try {
      const res = await api<{ accessToken: string }>("/v1/auth/otp/verify", { body: { phone, code } });
      onLogin(res.accessToken);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="card">
      <p>মোবাইল নম্বর দিয়ে লগইন করুন</p>
      <div className="row">
        <input inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button onClick={requestOtp}>OTP</button>
      </div>
      {sent && (
        <div className="row" style={{ marginTop: 8 }}>
          <input inputMode="numeric" placeholder="৬ সংখ্যার কোড" value={code} onChange={(e) => setCode(e.target.value)} />
          <button onClick={verify}>লগইন</button>
        </div>
      )}
      {hint && <p className="muted">{hint}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function FamilyHome({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [family, setFamily] = useState<Family | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [aiSummary, setAiSummary] = useState<MonthlyAiSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) onLogout();
    else setError((e as Error).message);
  }, [onLogout]);

  const refresh = useCallback(async (fam: Family) => {
    const [cats, accs, sum, ai] = await Promise.all([
      api<Category[]>(`/v1/families/${fam.id}/categories`, { token }),
      api<Account[]>(`/v1/families/${fam.id}/accounts`, { token }),
      api<MonthSummary>(`/v1/families/${fam.id}/reports/summary`, { token }),
      api<MonthlyAiSummary>(`/v1/families/${fam.id}/ai/summary?locale=bn`, { token }),
    ]);
    setCategories(cats); setAccounts(accs); setSummary(sum); setAiSummary(ai);
  }, [token]);

  useEffect(() => {
    api<{ families: Family[] }>("/v1/me", { token })
      .then(async (me) => {
        const fam = me.families[0] ?? null;
        setFamily(fam);
        if (fam) await refresh(fam);
      })
      .catch(handle)
      .finally(() => setLoaded(true));
  }, [token, refresh, handle]);

  if (!loaded) return <p className="muted">লোড হচ্ছে…</p>;
  if (!family) return <CreateFamily token={token} onCreated={(f) => { setFamily(f); refresh(f).catch(handle); }} />;

  return (
    <>
      <QuickAdd token={token} family={family} categories={categories} accounts={accounts}
        onSaved={() => refresh(family).catch(handle)} onError={handle} />
      {aiSummary && <SpokenSummary summary={aiSummary} />}
      {summary && <Summary summary={summary} />}
      {error && <p className="error">{error}</p>}
      <button className="secondary" onClick={onLogout}>লগআউট</button>
    </>
  );
}

function CreateFamily({ token, onCreated }: { token: string; onCreated: (f: Family) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="card">
      <p>আপনার পরিবারের নাম দিন</p>
      <div className="row">
        <input value={name} placeholder="যেমন: রহমান পরিবার" onChange={(e) => setName(e.target.value)} />
        <button onClick={async () => onCreated(await api<Family>("/v1/families", { body: { name }, token }))}>তৈরি করুন</button>
      </div>
    </div>
  );
}

function QuickAdd(props: {
  token: string; family: Family; categories: Category[]; accounts: Account[];
  onSaved: () => void; onError: (e: unknown) => void;
}) {
  const { token, family, categories, accounts, onSaved, onError } = props;
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
        token, body: { text: input, now: new Date().toISOString() },
      });
      // Voice entries come back marked as voice, so reports can tell them apart.
      const list = spoken ? res.drafts.map((d) => ({ ...d, source: "voice" as const })) : res.drafts;
      setDrafts(list);
      if (spoken) readBack(list);
    } catch (e) { onError(e); } finally { setBusy(false); }
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
        token,
        body: {
          type: d.type, amountPaisa: d.amountPaisa, feePaisa: d.feePaisa, occurredAt: d.occurredAt,
          categoryId: categories.find((c) => c.key === d.categoryKey)?.id ?? null,
          accountId: accounts.find((a) => a.type === d.accountType)?.id ?? null,
          note: d.note, counterparty: d.counterparty ?? undefined, trxId: d.trxId ?? undefined,
          source: d.source, aiConfidence: d.confidence,
        },
      });
      setDrafts((prev) => {
        const rest = prev?.filter((_, j) => j !== i) ?? [];
        return rest.length ? rest : null;
      });
      setText("");
      onSaved();
    } catch (e) { onError(e); }
  }

  const categoryName = (key: string | null) => {
    const c = categories.find((x) => x.key === key);
    return c ? `${c.icon ?? ""} ${c.nameBn}` : "ক্যাটাগরি বাছাই করুন";
  };

  return (
    <div className="card">
      <button className="mic" onClick={voice.listening ? voice.stop : listen} disabled={!voice.supported || busy}
        aria-label={t("tapToSpeak")}>
        <span aria-hidden="true">🎤</span> {voice.listening ? t("listening") : t("tapToSpeak")}
      </button>
      {!voice.supported && <p className="muted">{t("voiceUnsupported")}</p>}
      {voice.error && <p className="error">{voice.error}</p>}
      <textarea rows={3} placeholder={t("quickAddPlaceholder")} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={() => parse()} disabled={busy || !text.trim()}>{busy ? "…" : t("parse")}</button>
      </div>
      {drafts && drafts.length === 0 && <p className="muted">{t("noDrafts")}</p>}
      {drafts && drafts.length > 0 && (
        <ul style={{ marginTop: 12 }}>
          {drafts.map((d, i) => (
            <li key={i} className="draft">
              <span className="draft-text">
                <span className="draft-icon" aria-hidden="true">{categoryOf(d.categoryKey)?.icon ?? "📦"}</span>
                <span>
                  <strong>{formatBDT(d.amountPaisa, { bnDigits: true })}</strong>
                  <br />
                  <span className="muted">{categoryName(d.categoryKey)} · {d.note}</span>
                </span>
              </span>
              {!d.categoryKey && (
                <CategoryPicker categories={categories.filter((c) => c.kind === (d.type === "income" ? "income" : "expense"))}
                  onPick={(key) => setDrafts((prev) => prev?.map((x, j) => (j === i ? { ...x, categoryKey: key } : x)) ?? null)} />
              )}
              <span className="row">
                <button className="icon secondary" aria-label={t("speak")}
                  onClick={() => speak(draftToSpeech(d, categoryOf(d.categoryKey)?.nameBn ?? null))}>🔊</button>
                <button className="icon danger" aria-label={t("no")}
                  onClick={() => setDrafts((prev) => {
                    const rest = prev?.filter((_, j) => j !== i) ?? [];
                    return rest.length ? rest : null;
                  })}>✗</button>
                <button className="icon" aria-label={t("yes")} onClick={() => confirm(d, i)}>✓</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Summary({ summary }: { summary: MonthSummary }) {
  return (
    <div className="card">
      <p className="muted">{t("thisMonth")} · {t("totalExpense")}</p>
      <p className="big">{formatBDT(summary.expensePaisa, { bnDigits: true })}</p>
      <ul>
        {summary.byCategory.map((c) => (
          <li key={c.categoryId ?? "none"}>
            <span>{c.name}</span>
            <span>{formatBDT(c.totalPaisa, { bnDigits: true })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Monthly summary in plain words, with a button to hear it (FR-AI-11, FR-VOICE-04). */
function SpokenSummary({ summary }: { summary: MonthlyAiSummary }) {
  const [speaking, setSpeaking] = useState(false);
  function toggle() {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    setSpeaking(speak(summary.speechText, summary.locale === "bn" ? "bn-BD" : "en-IN"));
  }
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{t("monthlySummary")}</strong>
        <button className="secondary" onClick={toggle}>{speaking ? `⏹ ${t("stop")}` : `🔊 ${t("speak")}`}</button>
      </div>
      <p className="summary-text">{summary.text}</p>
    </div>
  );
}

/** Icon grid so users who can't read comfortably can still choose a category (SRS §4.1.1). */
function CategoryPicker({ categories, onPick }: { categories: Category[]; onPick: (key: string) => void }) {
  return (
    <div className="picker" role="group" aria-label="ক্যাটাগরি">
      {categories.map((c) => (
        <button key={c.id} className="picker-item secondary" onClick={() => onPick(c.key)}
          onFocus={() => speak(c.nameBn)} title={c.nameBn} aria-label={c.nameBn}>
          <span aria-hidden="true">{c.icon}</span>
          <small>{c.nameBn}</small>
        </button>
      ))}
    </div>
  );
}
