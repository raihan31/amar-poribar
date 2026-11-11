"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/useT";
import { Icon } from "@/components/ui/icons";
import { OtpStep, type VerifyResult } from "@/components/features/auth/OtpStep";
import { PhoneStep } from "@/components/features/auth/PhoneStep";

/** Only same-site paths; anything else falls back to the home screen. */
function safeNext(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function LoginFlow() {
  const t = useT();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [sent, setSent] = useState<{ phone: string; devCode?: string } | null>(null);

  const done = (res: VerifyResult) => {
    router.replace(res.families && res.families.length === 0 ? "/consent" : (next ?? "/"));
  };

  return (
    <main className="auth">
      <div className="auth__logo">
        <Icon name="home" size={48} />
      </div>
      <h1 className="auth__title">{t("appName")}</h1>
      <p className="auth__tagline">{t("auth.tagline")}</p>
      {sent ? (
        <OtpStep phone={sent.phone} devCode={sent.devCode} onVerified={done} onChangePhone={() => setSent(null)} />
      ) : (
        <PhoneStep onSent={(phone, devCode) => setSent({ phone, devCode })} />
      )}
      <p className="auth__footer">{t("auth.footer")}</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginFlow />
    </Suspense>
  );
}
