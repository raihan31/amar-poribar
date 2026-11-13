"use client";

import { Icon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/Toggle";
import { useT } from "@/lib/i18n/useT";

/** "ব্যক্তিগত (শুধু আমি দেখব)" with a lock. */
export function PrivateToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  const label = `${t("entry.form.private")} ${t("entry.form.privateHint")}`;
  return (
    <div className="entry-private">
      <Icon name="lock" size={24} />
      <span>
        <strong>{t("entry.form.private")}</strong> {t("entry.form.privateHint")}
      </span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
