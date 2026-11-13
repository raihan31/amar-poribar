"use client";

import "@/styles/settings.css";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NameEditor } from "@/components/features/settings/NameEditor";
import { SegmentRow } from "@/components/features/settings/SegmentRow";
import { SettingRow } from "@/components/features/settings/SettingRow";
import { SwitchRow } from "@/components/features/settings/SwitchRow";
import { TimeRow } from "@/components/features/settings/TimeRow";
import { useSavedPrefs } from "@/components/features/settings/useSavedPrefs";
import { PolicyDialog } from "@/components/features/onboarding/PolicyDialog";
import { BackHeader } from "@/components/shell/BackHeader";
import { useFamily } from "@/components/shell/useFamily";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";
import { cleanPhoneInput, formatPhoneDisplay, fromBnDigits } from "@/lib/auth/phone";
import { formatClock } from "@/lib/format/clock";
import { useFormat } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";

/** F8: name, phone, language, numerals, Simple mode, reminder and presence (FR-AUTH-04, FR-PRES-02). */
export default function ProfilePage() {
  const t = useT();
  const qc = useQueryClient();
  const { locale, numerals, simple, setPreference } = useI18n();
  const { num } = useFormat();
  const { me } = useFamily();
  const { prefs, save, toast } = useSavedPrefs();
  const [policyOpen, setPolicyOpen] = useState(false);

  const name = typeof me?.name === "string" ? me.name : "";
  const rawPhone = typeof me?.phone === "string" ? cleanPhoneInput(me.phone) : "";
  const phone = numerals === "bn" ? formatPhoneDisplay(rawPhone) : fromBnDigits(formatPhoneDisplay(rawPhone));

  return (
    <>
      <BackHeader title={t("prof.title")} />
      <main className="set">
        <section className="set-card">
          <NameEditor
            name={name}
            onSave={async (next) => {
              await api("/v1/me", { method: "PATCH", body: { name: next } });
              await qc.invalidateQueries({ queryKey: qk.me() });
            }}
          />
          <SettingRow title={t("prof.phone")} sub={phone} />
        </section>

        <section className="set-card">
          <SegmentRow
            label={t("set.language")}
            value={locale}
            onChange={(v) => setPreference({ locale: v })}
            options={[
              { value: "bn", label: t("onb.langBn") },
              { value: "en", label: t("onb.langEn") },
            ]}
          />
          <SegmentRow
            label={t("set.numbers")}
            value={numerals}
            onChange={(v) => setPreference({ numerals: v })}
            options={[
              { value: "bn", label: t("onb.numBn") },
              { value: "latn", label: t("onb.numLatn") },
            ]}
          />
          <SwitchRow
            tone="green"
            label={t("set.simple")}
            sub={t("set.simpleHelp")}
            checked={simple}
            onChange={(v) => setPreference({ simple: v })}
          />
          <SwitchRow
            label={t("set.reminder")}
            sub={t("set.reminderAt", { time: formatClock(prefs.dailyReminderTime, locale, num) })}
            checked={prefs.dailyReminderEnabled}
            onChange={(v) => save({ dailyReminderEnabled: v })}
          />
          {prefs.dailyReminderEnabled && (
            <TimeRow
              label={t("set.reminderChange")}
              value={prefs.dailyReminderTime}
              onChange={(v) => save({ dailyReminderTime: v })}
            />
          )}
          <SwitchRow
            label={t("set.hidePresence")}
            sub={t("set.hidePresenceHelp")}
            checked={prefs.hidePresence}
            onChange={(v) => save({ hidePresence: v })}
          />
        </section>

        <section className="set-card">
          <SettingRow title={t("onb.policy")} onClick={() => setPolicyOpen(true)} />
          <SettingRow title={t("set.delete")} sub={t("set.deleteHelp")} tone="danger" href="/delete-account" />
        </section>
      </main>
      <PolicyDialog open={policyOpen} onClose={() => setPolicyOpen(false)} />
      {toast}
    </>
  );
}
