"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { safeNext, staffLogin, staffTotp, type LoginResult } from "@/lib/auth/staffAuth";
import { EnrollTotp } from "./EnrollTotp";
import { LockoutNotice } from "./LockoutNotice";
import { TOTP_LENGTH, TotpInput } from "./TotpInput";

type Phase =
  | { kind: "credentials" }
  | { kind: "totp"; challengeId: string }
  | { kind: "enroll"; challengeId: string; otpauthUri: string; secret: string };

type Focus = "email" | "code" | null;

const INFO = "Ask a Staff Owner to reset it. Every reset is written to the audit log.";

export function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const errId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "credentials" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedFor, setLockedFor] = useState<number | null>(null);
  const pendingFocus = useRef<Focus>(null);
  const setFocus = (f: Focus) => {
    pendingFocus.current = f;
  };
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const focus = pendingFocus.current;
    if (!focus) return;
    const root = formRef.current;
    const el =
      focus === "email"
        ? root?.querySelector<HTMLElement>("#signin-email")
        : root?.querySelector<HTMLElement>('[aria-label="Digit 1"]');
    el?.focus();
    pendingFocus.current = null;
  });

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (info && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!info && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [info]);

  const locked = lockedFor !== null;
  const codeEnabled = phase.kind === "totp" && !locked;
  const credsEditable = phase.kind === "credentials" && !locked && !busy;

  function fail(r: Extract<LoginResult, { kind: "error" }>) {
    switch (r.code) {
      case "invalid_credentials":
        setError("Email or password is not correct.");
        setFocus("email");
        break;
      case "account_locked":
        setError(null);
        setLockedFor(r.retryAfterSeconds ?? 15 * 60);
        break;
      case "totp_invalid":
        setError(
          `That code is not correct. Try the next code.${
            r.attemptsLeft !== undefined
              ? ` ${r.attemptsLeft} ${r.attemptsLeft === 1 ? "attempt" : "attempts"} left.`
              : ""
          }`,
        );
        setCode("");
        setFocus("code");
        break;
      case "totp_expired":
        setError("Code expired. Enter the newest code.");
        setCode("");
        setFocus("code");
        break;
      default:
        setError("Could not sign in. Check your connection and try again.");
    }
  }

  async function submitCredentials() {
    const r = await staffLogin(email.trim(), password);
    if (r.kind === "totp_required") {
      setPhase({ kind: "totp", challengeId: r.challengeId });
      setFocus("code");
    } else if (r.kind === "totp_enroll") {
      setPhase({ kind: "enroll", challengeId: r.challengeId, otpauthUri: r.otpauthUri, secret: r.secret });
    } else fail(r);
  }

  async function submitCode(challengeId: string, value: string) {
    const r = await staffTotp(challengeId, value);
    if (r.kind === "ok") router.replace(safeNext(search.get("next")));
    else fail(r);
  }

  async function run(fn: () => Promise<void>) {
    if (busy || locked) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (phase.kind === "credentials") void run(submitCredentials);
    else if (phase.kind === "totp" && code.length === TOTP_LENGTH) void run(() => submitCode(phase.challengeId, code));
  }

  function onExpire() {
    setLockedFor(null);
    setPhase({ kind: "credentials" });
    setPassword("");
    setCode("");
  }

  return (
    <>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="signin__form" aria-busy={busy}>
        <div className="field">
          <label htmlFor="signin-email">Work email</label>
          <input
            id="signin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!credsEditable}
            aria-invalid={error && phase.kind === "credentials" ? true : undefined}
            aria-describedby={error ? errId : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="signin-password">Password</label>
          <div className="pw">
            <input
              id="signin-password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!credsEditable}
              aria-invalid={error && phase.kind === "credentials" ? true : undefined}
              aria-describedby={error ? errId : undefined}
            />
            <button type="button" className="pw__toggle" aria-pressed={showPw} onClick={() => setShowPw((v) => !v)}>
              Show
            </button>
          </div>
        </div>

        {phase.kind === "enroll" ? (
          <EnrollTotp
            otpauthUri={phase.otpauthUri}
            secret={phase.secret}
            busy={busy || locked}
            invalid={!!error}
            describedBy={error ? errId : undefined}
            onConfirm={(c) => void run(() => submitCode(phase.challengeId, c))}
          />
        ) : (
          <>
            <TotpInput
              label="6-digit code from your authenticator app"
              value={code}
              onChange={setCode}
              disabled={!codeEnabled || busy}
              invalid={!!error && phase.kind === "totp"}
              describedBy={error ? errId : undefined}
            />
            <Button
              type="submit"
              variant="primary"
              className="signin__submit"
              disabled={busy || locked || (phase.kind === "totp" && code.length !== TOTP_LENGTH)}
            >
              Sign in
            </Button>
          </>
        )}

        {error && (
          <div id={errId} role="alert" className="error signin__error">
            {error}
          </div>
        )}
        {lockedFor !== null && <LockoutNotice retryAfterSeconds={lockedFor} onExpire={onExpire} />}

        <div className="signin__links">
          <button type="button" className="linklike" onClick={() => setInfo("Forgot password?")}>
            Forgot password?
          </button>
          <button type="button" className="linklike" onClick={() => setInfo("Lost your device?")}>
            Lost your device?
          </button>
        </div>
      </form>

      <dialog ref={dialogRef} className="signin__info" aria-labelledby={`${errId}-t`} onClose={() => setInfo(null)}>
        <h2 id={`${errId}-t`}>{info}</h2>
        <p>{INFO}</p>
        <Button variant="primary" onClick={() => setInfo(null)}>
          OK
        </Button>
      </dialog>
    </>
  );
}
