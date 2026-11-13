"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { UpdateNotificationPreferences } from "@amar-poribar/shared";
import { Toast } from "@/components/ui/Toast";
import { useNotificationPrefs } from "@/lib/api/hooks/useNotificationPrefs";
import { useT } from "@/lib/i18n/useT";

/** Notification preferences plus a `save` that rolls back and raises the "সেভ হয়নি" toast on failure. */
export function useSavedPrefs(): {
  prefs: ReturnType<typeof useNotificationPrefs>["prefs"];
  save: (patch: UpdateNotificationPreferences) => void;
  toast: ReactNode;
} {
  const t = useT();
  const { prefs, update } = useNotificationPrefs();
  const [failed, setFailed] = useState(false);
  const save = useCallback(
    (patch: UpdateNotificationPreferences) => {
      setFailed(false);
      update(patch, () => setFailed(true));
    },
    [update],
  );
  const clear = useCallback(() => setFailed(false), []);
  return { prefs, save, toast: failed ? <Toast message={t("set.saveFailed")} onDone={clear} /> : null };
}
