"use client";

import "@/styles/settings.css";
import { useState } from "react";
import { PolicyDialog } from "@/components/features/onboarding/PolicyDialog";
import { QuietHoursRow } from "@/components/features/settings/QuietHoursRow";
import { SegmentRow } from "@/components/features/settings/SegmentRow";
import { SettingRow } from "@/components/features/settings/SettingRow";
import { SwitchRow } from "@/components/features/settings/SwitchRow";
import { TimeRow } from "@/components/features/settings/TimeRow";
import { useSavedPrefs } from "@/components/features/settings/useSavedPrefs";
import { BackHeader } from "@/components/shell/BackHeader";
import { useFamily } from "@/components/shell/useFamily";
import { formatClock } from "@/lib/format/clock";
import { useFormat } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import { useSpeak } from "@/lib/speech/useSpeak";

/** B6: language, numerals, Simple mode, reminder and quiet hours (FR-AUTH-04, FR-NOTIF-05, FR-VOICE-09). */
export default function SettingsPage() {
  const t = useT();
  const { locale, numerals, simple, setPreference } = useI18n();
  const { num } = useFormat();
  const { family } = useFamily();
  const { speak } = useSpeak();
  const { prefs, save, toast } = useSavedPrefs();
  const [policyOpen, setPolicyOpen] = useState(false);

  return (
    <>
      <BackHeader title={t("set.title")} />
      <main className="set">
        <section className="set-card">
          <SwitchRow
            tone="green"
            label={t("set.simple")}
            sub={t("set.simpleHelp")}
            checked={simple}
            onChange={(v) => setPreference({ simple: v })}
          />
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
          <QuietHoursRow start={prefs.quietStart} end={prefs.quietEnd} onChange={save} />
        </section>

        <section className="set-card">
          <SettingRow title={t("set.csv")} download={`/api/proxy/v1/families/${family.id}/reports/export.csv`} />
          <SettingRow title={t("set.categories")} href="/categories" />
          <SettingRow title={t("set.accounts")} href="/accounts" />
          <SettingRow
            title={t("set.guide")}
            icon="speaker"
            onClick={() => speak(t("set.guideText"), { interrupt: true })}
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
