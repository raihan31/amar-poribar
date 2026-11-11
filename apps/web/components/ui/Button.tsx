import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "buzz" | "danger";
export type ButtonSize = "md" | "lg" | "xl";

export const BUTTON_HEIGHT: Record<ButtonSize, number> = { md: 48, lg: 56, xl: 72 };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  className,
  style,
  type = "button",
  ...rest
}: ButtonProps) {
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  return (
    <button
      {...rest}
      type={type}
      aria-disabled={disabled ? true : undefined}
      onClick={handle}
      className={cx("ui-btn", `ui-btn--${variant}`, className)}
      style={{ minHeight: BUTTON_HEIGHT[size], ...style }}
    />
  );
}
