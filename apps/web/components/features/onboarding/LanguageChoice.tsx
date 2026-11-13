"use client";

import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import { ChoiceGroup } from "./ChoiceGroup";

export function LanguageChoice() {
  const t = useT();
  const { locale, setPreference } = useI18n();
  return (
    <ChoiceGroup
      label={t("onb.language")}
      value={locale}
      onChange={(v) => setPreference({ locale: v })}
      options={[
        { value: "bn", label: t("onb.langBn") },
        { value: "en", label: t("onb.langEn") },
      ]}
    />
  );
}
