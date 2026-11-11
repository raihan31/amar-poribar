import { useId, type InputHTMLAttributes } from "react";
import { cx } from "./cx";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, className, ...rest }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={cx("ui-field", className)}>
      <label htmlFor={id}>{label}</label>
      <input
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
      />
      {hint && (
        <span id={hintId} className="ui-field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} role="alert" className="ui-field__error">
          {error}
        </span>
      )}
    </div>
  );
}
