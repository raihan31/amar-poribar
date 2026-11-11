import { useId, type SelectHTMLAttributes } from "react";

export interface Option {
  value: string;
  label: string;
}

export function SelectField({
  label,
  options,
  ...rest
}: { label: string; options: Option[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
