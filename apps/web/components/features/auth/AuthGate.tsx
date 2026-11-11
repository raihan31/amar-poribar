"use client";

import { useEffect, useState } from "react";
import { t } from "@amar-poribar/shared";
import { api } from "@/lib/api";
import { FamilyHome } from "../family/FamilyHome";
import { LoginForm } from "./LoginForm";

export function AuthGate() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    api<{ authenticated: boolean }>("/api/auth/session")
      .then((s) => setAuthed(s.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  const onLogout = () => {
    api("/api/auth/logout", { method: "POST", body: {} })
      .catch(() => undefined)
      .finally(() => setAuthed(false));
  };

  return (
    <main>
      <h1>
        {t("appName")} <span className="muted">· Amar Poribar</span>
      </h1>
      {authed === null ? null : authed ? (
        <FamilyHome onLogout={onLogout} />
      ) : (
        <LoginForm onLogin={() => setAuthed(true)} />
      )}
    </main>
  );
}
