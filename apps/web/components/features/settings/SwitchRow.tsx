"use client";

import { useId } from "react";
import { cx } from "@/components/ui/cx";
import { RowText, type RowTone } from "./SettingRow";

export interface SwitchRowProps {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone?: RowTone;
}

/** A row with a 56×32 switch. The switch is a real checkbox named by the row title. */
export function SwitchRow({ label, sub, checked, onChange, tone = "plain" }: SwitchRowProps) {
  const id = useId();
  return (
    <label className={cx("set-row", tone === "green" && "set-row--green")}>
      <RowText title={label} sub={sub} tone={tone} titleId={id} />
      <input
        type="checkbox"
        className="set-switch"
        aria-labelledby={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
