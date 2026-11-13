"use client";

import { useRouter } from "next/navigation";
import "@/styles/onboarding.css";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { LanguageChoice } from "@/components/features/onboarding/LanguageChoice";
import { NumeralChoice } from "@/components/features/onboarding/NumeralChoice";
import { SimpleModeToggle } from "@/components/features/onboarding/SimpleModeToggle";
import { useT } from "@/lib/i18n/useT";

export default function WelcomePage() {
  const t = useT();
  const router = useRouter();
  return (
    <main className="auth onb">
      <div className="auth__logo">
        <Icon name="home" size={42} />
      </div>
      <h1 className="auth__title">{t("onb.welcome")}</h1>
      <p className="auth__tagline">{t("onb.welcomeSub")}</p>
      <LanguageChoice />
      <NumeralChoice />
      <SimpleModeToggle />
      <p className="auth__footer">{t("onb.changeLater")}</p>
      <Button size="xl" onClick={() => router.push("/login")}>
        {t("onb.next")}
      </Button>
    </main>
  );
}
