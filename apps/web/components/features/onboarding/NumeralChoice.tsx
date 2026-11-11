"use client";

import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import { ChoiceGroup } from "./ChoiceGroup";

export function NumeralChoice() {
  const t = useT();
  const { numerals, setPreference } = useI18n();
  return (
    <ChoiceGroup
      label={t("onb.numbers")}
      value={numerals}
      onChange={(v) => setPreference({ numerals: v })}
      options={[
        { value: "bn", label: t("onb.numBn") },
        { value: "latn", label: t("onb.numLatn") },
      ]}
    />
  );
}
