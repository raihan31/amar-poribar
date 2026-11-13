"use client";

import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";

export interface SegmentRowProps<T extends string> {
  label: string;
  options: Array<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
}

/** A row with the label on the left and a pill group on the right. */
export function SegmentRow<T extends string>({ label, options, value, onChange }: SegmentRowProps<T>) {
  return (
    <div className="set-row">
      <span className="set-row__text">
        <span className="set-row__title">{label}</span>
      </span>
      <SegmentedControl label={label} options={options} value={value} onChange={onChange} />
    </div>
  );
}
