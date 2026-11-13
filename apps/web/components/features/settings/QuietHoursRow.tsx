"use client";

import { useId } from "react";
import { formatClock } from "@/lib/format/clock";
import { useFormat } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";

export interface QuietHoursRowProps {
  /** "HH:mm" */
  start: string;
  end: string;
  onChange: (patch: { quietStart?: string; quietEnd?: string }) => void;
}

/** "Vibration and sound" row: a spoken summary of the quiet window and two time pickers. */
export function QuietHoursRow({ start, end, onChange }: QuietHoursRowProps) {
  const t = useT();
  const { locale } = useI18n();
  const { num } = useFormat();
  const id = useId();
  const range = (hhmm: string) =>
    hhmm
      .split(":")
      .map(Number)
      .map((n) => (n < 10 ? `${num(0)}${num(n)}` : num(n)))
      .join(":");
  return (
    <div className="set-row set-row--stack">
      <span className="set-row__text">
        <span className="set-row__title">{t("set.quiet")}</span>
        <span className="set-row__sub">
          {t("set.quietSummary", {
            from: formatClock(start, locale, num, { short: true }),
            to: formatClock(end, locale, num, { short: true }),
          })}
        </span>
        <span className="set-row__sub">{`${range(start)} – ${range(end)}`}</span>
      </span>
      <span className="set-quiet">
        <label htmlFor={`${id}-s`}>{t("set.quietFrom")}</label>
        <input
          id={`${id}-s`}
          type="time"
          className="set-time"
          value={start}
          onChange={(e) => e.target.value && onChange({ quietStart: e.target.value })}
        />
        <label htmlFor={`${id}-e`}>{t("set.quietTo")}</label>
        <input
          id={`${id}-e`}
          type="time"
          className="set-time"
          value={end}
          onChange={(e) => e.target.value && onChange({ quietEnd: e.target.value })}
        />
      </span>
    </div>
  );
}
