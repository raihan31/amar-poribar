"use client";

import { useEffect } from "react";
import { api } from "@/lib/api/client";
import { useI18n, type PrefPatch } from "@/lib/i18n/provider";

const DEBOUNCE_MS = 500;

/** Syncs preference changes to `PATCH /v1/me` (debounced) when the user is signed in. */
export function PreferenceBridge({ signedIn }: { signedIn: boolean }) {
  const { subscribe } = useI18n();
  useEffect(() => {
    if (!signedIn) return;
    let pending: PrefPatch = {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribe((patch) => {
      pending = { ...pending, ...patch };
      clearTimeout(timer);
      timer = setTimeout(() => {
        const p = pending;
        pending = {};
        const body: { locale?: string; numeralStyle?: "bn" | "latin"; simpleMode?: boolean } = {};
        if (p.locale !== undefined) body.locale = p.locale;
        if (p.numerals !== undefined) body.numeralStyle = p.numerals === "bn" ? "bn" : "latin";
        if (p.simple !== undefined) body.simpleMode = p.simple;
        // The cookie already holds the choice; a failed sync must not break the page.
        api("/v1/me", { method: "PATCH", body }).catch(() => {});
      }, DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [signedIn, subscribe]);
  return null;
}
