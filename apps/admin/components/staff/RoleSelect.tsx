import { SelectField } from "@/components/ui/SelectField";
import { ROLE_LABEL, STAFF_ROLES } from "@/lib/permissions";

/** Design order: Support, Read-only, Owner. */
const ORDER = ["support", "readonly", "owner"] as const;
const OPTIONS = ORDER.filter((r) => STAFF_ROLES.includes(r)).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

export function RoleSelect({
  value,
  onChange,
  label = "Role",
}: {
  value: string;
  onChange: (role: string) => void;
  label?: string;
}) {
  return <SelectField label={label} options={OPTIONS} value={value} onChange={(e) => onChange(e.target.value)} />;
}
