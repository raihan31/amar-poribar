"use client";

import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { useT } from "@/lib/i18n/useT";

/** Plain Bangla server-error message with one next step. */
export function ErrorView({ reset }: { reset: () => void }) {
  const t = useT();
  return (
    <main className="error-view">
      <EmptyState icon="warning" title={t("net.serverError")}>
        <Button size="lg" onClick={reset}>
          {t("net.retry")}
        </Button>
      </EmptyState>
    </main>
  );
}
