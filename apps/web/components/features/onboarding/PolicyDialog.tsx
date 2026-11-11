"use client";

import { useQuery } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import { fetchPolicy } from "@/lib/api/policy";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";

export function PolicyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { locale } = useI18n();
  const q = useQuery({ queryKey: ["policy", locale], queryFn: () => fetchPolicy(locale), enabled: open });
  return (
    <Dialog open={open} onClose={onClose} title={t("onb.policy")} closeLabel={t("fam.close")}>
      {open && q.isPending && <Spinner label={t("common.loading")} />}
      {q.isError && <p role="alert">{t("onb.policyFailed")}</p>}
      {q.data && <div className="onb__policy">{q.data.text}</div>}
    </Dialog>
  );
}
