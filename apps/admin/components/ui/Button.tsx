import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ variant = "secondary", type = "button", className, ...rest }: ButtonProps) {
  return <button type={type} className={`ui-btn ui-btn--${variant}${className ? ` ${className}` : ""}`} {...rest} />;
}
