"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/useT";
import { LoginForm } from "@/components/features/auth/LoginForm";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function LoginRoute() {
  const next = safeNext(useSearchParams().get("next"));
  return <LoginForm onLogin={() => window.location.assign(next)} />;
}

export default function LoginPage() {
  const t = useT();
  return (
    <main>
      <h1>
        {t("appName")} <span className="muted">· Amar Poribar</span>
      </h1>
      <Suspense>
        <LoginRoute />
      </Suspense>
    </main>
  );
}
