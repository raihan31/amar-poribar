import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./icons";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  icon: IconName;
  /** Accessible name in the current language. */
  label: string;
}

export function IconButton({ icon, label, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button {...rest} type={type} aria-label={label} className={cx("ui-iconbtn", className)}>
      <Icon name={icon} size={26} />
    </button>
  );
}
