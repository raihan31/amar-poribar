"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/api/queryKeys";
import { can, normalizeRole, type Action, type StaffRole } from "@/lib/permissions";

export interface StaffSession {
  authenticated: boolean;
  name?: string;
  role?: string;
  expiresAt?: string;
}

/** Reads /api/staff/session once per page load. */
export function useStaff() {
  const q = useQuery({
    queryKey: qk.staffSession(),
    queryFn: async (): Promise<StaffSession> => {
      const res = await fetch("/api/staff/session", { credentials: "same-origin" });
      if (!res.ok) throw new Error("session");
      return (await res.json()) as StaffSession;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const role: StaffRole | undefined = q.data?.authenticated ? normalizeRole(q.data.role) : undefined;
  return { ...q, name: q.data?.name, role, can: (a: Action) => can(role, a) };
}
