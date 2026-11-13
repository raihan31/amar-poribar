"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import "@/styles/onboarding.css";
import { ConsentList } from "@/components/features/onboarding/ConsentList";
import { writeFid } from "@/components/shell/FamilyProvider";
import { api } from "@/lib/api/client";
import { useMe } from "@/lib/api/hooks/useMe";
import { fetchPolicy } from "@/lib/api/policy";
import { qk } from "@/lib/api/queryKeys";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import type { Family } from "@/lib/types";

export default function ConsentPage() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { locale } = useI18n();
  const { data } = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already has a family: nothing to do here.
  const families = (data as { families?: Family[] } | undefined)?.families;
  useEffect(() => {
    if (families && families.length > 0) router.replace("/");
  }, [families, router]);

  const submit = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      const policy = await fetchPolicy(locale);
      await api("/v1/me/consents", { body: { kind: "privacy", version: policy.version, locale } });
      const family = await api<Family>("/v1/families", { body: { name } });
      writeFid(family.id);
      await qc.invalidateQueries({ queryKey: qk.me() });
      router.replace("/");
    } catch {
      setError(t("onb.failed"));
      setBusy(false);
    }
  };

  return (
    <main className="auth onb">
      <h1 className="onb__title">{t("onb.title")}</h1>
      <p className="auth__tagline">{t("onb.step")}</p>
      <ConsentList onSubmit={submit} busy={busy} error={error} />
    </main>
  );
}
