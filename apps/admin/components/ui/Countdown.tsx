"use client";

import { useEffect, useState } from "react";

/** Days/hours left until `until`; re-renders every minute. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "Due now";
  const mins = Math.floor(ms / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function Countdown({ until, now = () => Date.now() }: { until: string | Date; now?: () => number }) {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), 60_000);
    return () => clearInterval(id);
  }, [now]);
  return <span>{formatRemaining(new Date(until).getTime() - t)}</span>;
}
