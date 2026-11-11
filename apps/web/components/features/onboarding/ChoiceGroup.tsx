import { Icon } from "@/components/ui/icons";

interface Props<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}

/** Two big (72 px) options; the selected one has a 3 px green border and a check mark. */
export function ChoiceGroup<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <section>
      <h2 className="onb__label">{label}</h2>
      <div role="radiogroup" aria-label={label} className="onb__choices">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className="onb__choice"
            onClick={() => onChange(o.value)}
          >
            {o.value === value && <Icon name="check" size={26} />}
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}
