"use client";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/useT";

/** Amber banner shown after a delete: the entry can come back for 30 days (FR-TXN-03, AC-14). */
export function UndoBanner({ busy, failed, onRestore }: { busy?: boolean; failed?: boolean; onRestore: () => void }) {
  const t = useT();
  return (
    <div className="txn-undo">
      <Banner tone="warn">{t("txn.deleted")}</Banner>
      {failed && <Banner tone="danger">{t("txn.failed")}</Banner>}
      <Button size="lg" onClick={onRestore} disabled={busy}>
        {t("txn.restore")}
      </Button>
    </div>
  );
}
