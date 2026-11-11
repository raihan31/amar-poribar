import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "aria-label"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name in the current language. */
  label: string;
}

export function Toggle({ checked, onChange, label, className, type = "button", ...rest }: ToggleProps) {
  return (
    <button
      {...rest}
      type={type}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx("ui-toggle", className)}
      onClick={() => onChange(!checked)}
    />
  );
}
