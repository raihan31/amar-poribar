"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/useT";
import type { RoleName } from "@/lib/types";
import { EmptyState } from "../ui/EmptyState";
import { ROLE_RANK, useFamily } from "./useFamily";

/** Renders children when the active role ranks at least `role`; otherwise the read-only message. */
export function RoleGate({ role, children }: { role: RoleName; children: ReactNode }) {
  const t = useT();
  const { role: mine } = useFamily();
  if (ROLE_RANK[mine] >= ROLE_RANK[role]) return <>{children}</>;
  return <EmptyState icon="lock" title={t("role.readOnly")} />;
}
