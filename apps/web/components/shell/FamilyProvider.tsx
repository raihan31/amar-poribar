"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/api/hooks/useMe";
import { useT } from "@/lib/i18n/useT";
import type { Family } from "@/lib/types";
import { Spinner } from "../ui/Spinner";
import { FamilyContext, type FamilyValue } from "./useFamily";

const FID_COOKIE = "ap_fid";

function readFid(): string | null {
  if (typeof document === "undefined") return null;
  const m = new RegExp(`(?:^|;\\s*)${FID_COOKIE}=([^;]+)`).exec(document.cookie);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

function writeFid(id: string) {
  document.cookie = `${FID_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
}

/** Loads `GET /v1/me`, picks the active family (cookie if still a member, else first) and exposes it. */
export function FamilyProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const { data } = useMe();
  const [chosen, setChosen] = useState<string | null>(null);

  const me = data as { user?: FamilyValue["me"]; families?: Family[] } | undefined;
  const families = useMemo(() => me?.families ?? [], [me]);

  useEffect(() => {
    if (me && families.length === 0) router.replace("/consent");
  }, [me, families.length, router]);

  const switchFamily = useCallback((id: string) => {
    writeFid(id);
    setChosen(id);
  }, []);

  const value = useMemo<FamilyValue | null>(() => {
    if (families.length === 0) return null;
    const wanted = chosen ?? readFid();
    const family = families.find((f) => f.id === wanted) ?? families[0]!;
    return { family, families, role: family.role, switchFamily, me: me?.user ?? null };
  }, [families, chosen, switchFamily, me]);

  if (!value) return <Spinner label={t("common.loading")} />;
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}
