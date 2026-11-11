import { cx } from "./cx";

export interface ProgressBarProps {
  /** Accessible name. */
  label: string;
  /** 0..100; values above 100 render a full bar. */
  percent: number;
  tone?: "ok" | "warn" | "danger";
}

export function ProgressBar({ label, percent, tone = "ok" }: ProgressBarProps) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      className={cx("ui-progress", tone !== "ok" && `ui-progress--${tone}`)}
    >
      <span style={{ width: `${p}%` }} />
    </div>
  );
}
