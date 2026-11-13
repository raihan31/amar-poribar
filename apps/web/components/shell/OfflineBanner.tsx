"use client";

import { useSyncExternalStore } from "react";
import { getNetworkFailed, subscribeNetwork } from "@/lib/api/network";
import { useOnline } from "@/lib/hooks/useOnline";
import { useOutboxCount } from "@/lib/outbox/useOutboxCount";
import { useT } from "@/lib/i18n/useT";
import { useFormat } from "@/lib/i18n/format";
import { Banner } from "@/components/ui/Banner";

/** Shown at once when the browser goes offline or an API call fails at the network level. */
export function OfflineBanner() {
  const t = useT();
  const f = useFormat();
  const online = useOnline();
  const netFailed = useSyncExternalStore(subscribeNetwork, getNetworkFailed, () => false);
  const queued = useOutboxCount();
  if (online && !netFailed) return null;
  return (
    <div className="offline-banner">
      <Banner tone="warn">
        <span>{t("net.offline")}</span>
        {queued > 0 && <span> {t("net.queued", { n: f.num(queued) })}</span>}
      </Banner>
    </div>
  );
}
