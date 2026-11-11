import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected = false, className, type = "button", ...rest }: ChipProps) {
  return <button {...rest} type={type} aria-pressed={selected} className={cx("ui-chip", className)} />;
}
