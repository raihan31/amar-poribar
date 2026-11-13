"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_PREFS, writePrefCookies, type Prefs } from "./cookie";

/** Partial change a user makes; mirrors the `PATCH /v1/me` fields. */
export type PrefPatch = Partial<Prefs>;
type Listener = (patch: PrefPatch) => void;

export interface I18nContextValue extends Prefs {
  setPreference: (patch: PrefPatch) => void;
  /** Called after every `setPreference`; used by `PreferenceBridge` to sync with the server. */
  subscribe: (fn: Listener) => () => void;
}

const I18nContext = createContext<I18nContextValue>({
  ...DEFAULT_PREFS,
  setPreference: () => {},
  subscribe: () => () => {},
});

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

/** Initial values come from the server-read cookies so the first paint has no flash. */
export function I18nProvider({ initial, children }: { initial: Prefs; children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    const el = document.documentElement;
    el.lang = prefs.locale;
    if (prefs.simple) el.setAttribute("data-simple", "1");
    else el.removeAttribute("data-simple");
    writePrefCookies(prefs);
  }, [prefs]);

  const setPreference = useCallback((patch: PrefPatch) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
    listeners.current.forEach((fn) => fn(patch));
  }, []);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const value = useMemo(() => ({ ...prefs, setPreference, subscribe }), [prefs, setPreference, subscribe]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
