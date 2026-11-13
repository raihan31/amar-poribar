"use client";

import { useId, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";
import { cleanPhoneInput, formatPhoneDisplay, parsePhone, toBnDigits } from "@/lib/auth/phone";
import { useT } from "@/lib/i18n/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";

export interface PhoneStepProps {
  /** Called after the code was sent; `devCode` is only present outside production. */
  onSent: (phone: string, devCode?: string) => void;
  initialDigits?: string;
}

export function PhoneStep({ onSent, initialDigits = "" }: PhoneStepProps) {
  const t = useT();
  const id = useId();
  const [digits, setDigits] = useState(initialDigits);
  const [invalid, setInvalid] = useState(false);
  const [limited, setLimited] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = parsePhone(digits);
    setInvalid(!parsed.ok);
    setLimited(null);
    setFailed(false);
    if (!parsed.ok) return;
    setBusy(true);
    try {
      const res = await api<{ sent?: boolean; devCode?: string }>("/api/auth/otp/request", {
        body: { phone: parsed.e164 },
      });
      onSent(parsed.e164, process.env.NODE_ENV !== "production" ? res?.devCode : undefined);
    } catch (err) {
      if (err instanceof ApiProblem && err.code === "otp_rate_limited") {
        const d = err.details as { retryAfterSeconds?: number } | undefined;
        setLimited(d?.retryAfterSeconds ?? 60);
      } else setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="auth__form" style={{ display: "grid", gap: 16 }}>
      <label htmlFor={id} className="auth__label">
        {t("auth.phoneLabel")}
      </label>
      <div className="auth__phone">
        <span aria-hidden>+{toBnDigits("88")}</span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={formatPhoneDisplay(digits)}
          onChange={(e) => setDigits(cleanPhoneInput(e.target.value))}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={`${id}-help`}
        />
      </div>
      {invalid ? (
        <p role="alert" className="auth__error">
          {t("auth.phoneInvalid")}
        </p>
      ) : null}
      <p id={`${id}-help`} className="auth__tagline" style={{ textAlign: "start" }}>
        {t("auth.phoneHelp")}
      </p>
      {limited !== null ? (
        <Banner tone="warn">{t("auth.rateLimited", { seconds: toBnDigits(String(limited)) })}</Banner>
      ) : null}
      {failed ? <Banner tone="danger">{t("auth.requestFailed")}</Banner> : null}
      <Button type="submit" size="xl" disabled={busy}>
        {t("auth.sendCode")}
      </Button>
    </form>
  );
}
