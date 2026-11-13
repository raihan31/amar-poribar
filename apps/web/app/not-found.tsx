"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n/useT";

export default function NotFound() {
  const t = useT();
  return (
    <main className="error-view">
      <EmptyState icon="info" title={t("net.notFound")}>
        <Link className="ui-btn ui-btn--primary" style={{ minHeight: 56 }} href="/">
          {t("net.goHome")}
        </Link>
      </EmptyState>
    </main>
  );
}
