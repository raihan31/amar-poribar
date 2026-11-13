"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationPreferences, UpdateNotificationPreferences } from "@amar-poribar/shared";
import { api } from "../client";
import { qk } from "../queryKeys";

/** Shown until the server answers, so the screen never waits (FR-NOTIF-05 defaults). */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  kinds: {
    budget_threshold: true,
    nudge: true,
    message: true,
    daily_reminder: true,
    bill_due: true,
    call_missed: true,
  },
  quietStart: "22:00",
  quietEnd: "06:00",
  dailyReminderTime: "21:00",
  dailyReminderEnabled: true,
  hidePresence: false,
};

function merge(prev: NotificationPreferences, patch: UpdateNotificationPreferences): NotificationPreferences {
  return { ...prev, ...patch, kinds: { ...prev.kinds, ...patch.kinds } } as NotificationPreferences;
}

/** `GET|PUT /v1/me/notification-preferences` with an optimistic update that rolls back on error. */
export function useNotificationPrefs() {
  const qc = useQueryClient();
  const key = qk.notificationPrefs();
  const query = useQuery({
    queryKey: key,
    queryFn: () => api<NotificationPreferences>("/v1/me/notification-preferences"),
  });
  const mutation = useMutation({
    mutationFn: (patch: UpdateNotificationPreferences) =>
      api<NotificationPreferences>("/v1/me/notification-preferences", { method: "PUT", body: patch }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<NotificationPreferences>(key);
      qc.setQueryData<NotificationPreferences>(key, merge(previous ?? DEFAULT_NOTIFICATION_PREFS, patch));
      return { previous };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      else qc.removeQueries({ queryKey: key });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  const { mutate } = mutation;
  /** `onError` runs after the rollback so the caller can show the toast. */
  const update = useCallback(
    (patch: UpdateNotificationPreferences, onError?: () => void) => mutate(patch, { onError }),
    [mutate],
  );
  return { prefs: query.data ?? DEFAULT_NOTIFICATION_PREFS, update };
}
