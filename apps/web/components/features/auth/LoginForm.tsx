"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/useT";

export function LoginForm({ onLogin }: { onLogin: () => void }) {
  const t = useT();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setError(null);
    try {
      const res = await api<{ devCode?: string }>("/api/auth/otp/request", { body: { phone } });
      setSent(true);
      setHint(res.devCode ? `Dev OTP: ${res.devCode}` : null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function verify() {
    setError(null);
    try {
      await api<{ ok: true }>("/api/auth/otp/verify", { body: { phone, code } });
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="card">
      <p>{t("login.prompt")}</p>
      <div className="row">
        <input inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button onClick={requestOtp}>OTP</button>
      </div>
      {sent && (
        <div className="row" style={{ marginTop: 8 }}>
          <input
            inputMode="numeric"
            placeholder={t("login.codePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button onClick={verify}>{t("login.submit")}</button>
        </div>
      )}
      {hint && <p className="muted">{hint}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
