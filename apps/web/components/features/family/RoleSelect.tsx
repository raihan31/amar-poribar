"use client";

import { useT } from "@/lib/i18n/useT";
import type { RoleName } from "@/lib/types";

export const ROLE_KEY = {
  owner: "roleOwner",
  admin: "roleAdmin",
  member: "roleMember",
  viewer: "roleViewer",
} as const satisfies Record<RoleName, string>;

export interface RoleSelectProps {
  value: RoleName;
  /** Roles the actor may assign; the current value is always listed so the select never lies. */
  options: RoleName[];
  label: string;
  onChange: (role: RoleName) => void;
}

export function RoleSelect({ value, options, label, onChange }: RoleSelectProps) {
  const t = useT();
  return (
    <select
      className="role-select"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value as RoleName)}
    >
      {[...new Set([value, ...options])].map((r) => (
        <option key={r} value={r}>
          {t(ROLE_KEY[r])}
        </option>
      ))}
    </select>
  );
}
