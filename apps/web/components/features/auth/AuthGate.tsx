"use client";

import { useEffect, useState } from "react";
import { t } from "@amar-poribar/shared";
import { FamilyHome } from "../family/FamilyHome";
import { LoginForm } from "./LoginForm";

const TOKEN_KEY = "amar-poribar.token";

function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function AuthGate() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => setToken(loadToken()), []);

  const onLogin = (tok: string) => {
    saveToken(tok);
    setToken(tok);
  };
  const onLogout = () => {
    saveToken(null);
    setToken(null);
  };

  return (
    <main>
      <h1>
        {t("appName")} <span className="muted">· Amar Poribar</span>
      </h1>
      {token ? <FamilyHome token={token} onLogout={onLogout} /> : <LoginForm onLogin={onLogin} />}
    </main>
  );
}
