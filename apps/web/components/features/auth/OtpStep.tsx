"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";
import { formatPhoneDisplay, toBnDigits } from "@/lib/auth/phone";
import { useT } from "@/lib/i18n/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { OtpBoxes } from "@/components/ui/OtpBoxes";
import { OtpErrorBanner } from "./OtpErrorBanner";
import { ResendTimer } from "./ResendTimer";

export interface VerifyResult {
  ok: true;
  families?: unknown[];
}

export interface OtpStepProps {
  /** Normalised `+8801XXXXXXXXX`. */
  phone: string;
  devCode?: string;
  onVerified: (res: VerifyResult) => void;
  onChangePhone: () => void;
}

type Problem =
  | { kind: "invalid"; attemptsLeft: number }
  | { kind: "expired" }
  | { kind: "limited"; seconds: number }
  | { kind: "failed" };

export function OtpStep({ phone, devCode: initialDev, onVerified, onChangePhone }: OtpStepProps) {
  const t = useT();
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const [devCode, setDevCode] = useState(initialDev);

  const attemptsLeft = problem?.kind === "invalid" ? problem.attemptsLeft : null;
  const locked = attemptsLeft === 0;
  const showA7 = problem?.kind === "invalid" || problem?.kind === "expired";

  async function verify(value: string) {
    if (busy || locked || value.length !== 6) return;
    setBusy(true);
    try {
      const res = await api<{ ok: true; families?: unknown[] }>("/api/auth/otp/verify", {
        body: { phone, code: value },
      });
      onVerified({ ok: true, families: res?.families });
    } catch (err) {
      if (err instanceof ApiProblem && err.code === "otp_invalid") {
        const d = err.details as { attemptsLeft?: number } | undefined;
        setProblem({ kind: "invalid", attemptsLeft: d?.attemptsLeft ?? 0 });
      } else if (err instanceof ApiProblem && err.code === "otp_expired") setProblem({ kind: "expired" });
      else setProblem({ kind: "failed" });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setProblem(null);
    setCode("");
    try {
      const res = await api<{ devCode?: string }>("/api/auth/otp/request", { body: { phone } });
      setDevCode(process.env.NODE_ENV !== "production" ? res?.devCode : undefined);
      setRound((r) => r + 1);
    } catch (err) {
      if (err instanceof ApiProblem && err.code === "otp_rate_limited") {
        const d = err.details as { retryAfterSeconds?: number } | undefined;
        setProblem({ kind: "limited", seconds: d?.retryAfterSeconds ?? 60 });
      } else setProblem({ kind: "failed" });
    }
  }

  const display = `+${toBnDigits("88")} ${formatPhoneDisplay(phone.slice(3))}`;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="auth__label">{t("auth.codeLabel")}</div>
      <p className="auth__tagline" style={{ textAlign: "start" }}>
        {t("auth.codeSentTo", { phone: display })}
      </p>
      <OtpBoxes
        key={round}
        boxLabel={(n) => t("auth.digitLabel", { n: toBnDigits(String(n)) })}
        invalid={showA7}
        disabled={busy || locked}
        onChange={(c) => {
          setCode(c);
          if (problem?.kind === "invalid" || problem?.kind === "expired") setProblem(null);
        }}
        onComplete={(c) => void verify(c)}
      />
      {problem?.kind === "invalid" ? (
        <OtpErrorBanner title={t("auth.invalidTitle")}>
          {locked
            ? t("auth.noAttempts")
            : t("auth.invalidBody", { attemptsLeft: toBnDigits(String(problem.attemptsLeft)) })}
        </OtpErrorBanner>
      ) : null}
      {problem?.kind === "expired" ? <OtpErrorBanner title={t("auth.expired")} /> : null}
      {problem?.kind === "limited" ? (
        <Banner tone="warn">{t("auth.rateLimited", { seconds: toBnDigits(String(problem.seconds)) })}</Banner>
      ) : null}
      {problem?.kind === "failed" ? <Banner tone="danger">{t("auth.verifyFailed")}</Banner> : null}
      {showA7 ? (
        <>
          <Button variant="secondary" size="lg" className="auth__outline" onClick={() => void resend()}>
            {t("auth.newCode")}
          </Button>
          <button type="button" className="auth__link" onClick={onChangePhone}>
            {t("auth.changePhone")}
          </button>
          <p className="auth__help">{t("auth.helpCard")}</p>
        </>
      ) : (
        <>
          <ResendTimer resetKey={round} onResend={() => void resend()} />
          <button type="button" className="auth__link" onClick={onChangePhone}>
            {t("auth.changePhone")}
          </button>
        </>
      )}
      <Button
        size="xl"
        className="auth__submit"
        disabled={busy || locked || code.length !== 6}
        onClick={() => void verify(code)}
      >
        {t("auth.submit")}
      </Button>
      {devCode && process.env.NODE_ENV !== "production" ? <p className="auth__dev">Dev OTP: {devCode}</p> : null}
    </div>
  );
}
