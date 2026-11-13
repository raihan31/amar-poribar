import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./icons";

export interface BigActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  label: string;
}

/** Icon over word; Home tiles. */
export function BigAction({ icon, label, className, style, type = "button", ...rest }: BigActionProps) {
  return (
    <button {...rest} type={type} className={cx("ui-big", className)} style={{ minHeight: 84, ...style }}>
      <Icon name={icon} size={32} />
      <span>{label}</span>
    </button>
  );
}
