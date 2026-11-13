"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/useT";
import { SessionExpiredCard } from "@/components/features/auth/ExpiredCards";

function Expired() {
  const t = useT();
  const raw = useSearchParams().get("next");
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return (
    <main className="auth">
      <SessionExpiredCard next={next} />
      <p className="auth__footer">{t("auth.footer")}</p>
    </main>
  );
}

export default function SessionExpiredPage() {
  return (
    <Suspense>
      <Expired />
    </Suspense>
  );
}
