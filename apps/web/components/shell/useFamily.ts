"use client";

import { createContext, useContext } from "react";
import type { Family, RoleName } from "@/lib/types";

export interface FamilyValue {
  family: Family;
  families: Family[];
  role: RoleName;
  switchFamily: (id: string) => void;
  me: { id?: string; [key: string]: unknown } | null;
}

export const FamilyContext = createContext<FamilyValue | null>(null);

export const ROLE_RANK: Record<RoleName, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export function useFamily(): FamilyValue {
  const v = useContext(FamilyContext);
  if (!v) throw new Error("useFamily must be used inside <FamilyProvider>");
  return v;
}
