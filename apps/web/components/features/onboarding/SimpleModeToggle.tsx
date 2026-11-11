"use client";

import { Toggle } from "@/components/ui/Toggle";
import { Icon } from "@/components/ui/icons";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";

export function SimpleModeToggle() {
  const t = useT();
  const { simple, setPreference } = useI18n();
  return (
    <div className="onb__simple">
      <Icon name="mic" size={34} />
      <div className="onb__simple-text">
        <div className="onb__simple-title">{t("onb.simple")}</div>
        <div className="onb__simple-help">{t("onb.simpleHelp")}</div>
      </div>
      <Toggle checked={simple} onChange={(v) => setPreference({ simple: v })} label={t("onb.simple")} />
    </div>
  );
}
