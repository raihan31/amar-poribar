import { useId, type InputHTMLAttributes } from "react";

export function TextField({
  label,
  error,
  ...rest
}: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-e` : undefined}
        {...rest}
      />
      {error && (
        <span id={`${id}-e`} className="error">
          {error}
        </span>
      )}
    </div>
  );
}
