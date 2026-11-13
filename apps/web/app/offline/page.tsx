"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n/useT";

// Served by the service worker when a navigation fails; must not need a session.
export default function OfflinePage() {
  const t = useT();
  return (
    <main className="error-view">
      <EmptyState icon="warning" title={t("net.offline")} hint={t("net.offlinePage")} />
    </main>
  );
}
