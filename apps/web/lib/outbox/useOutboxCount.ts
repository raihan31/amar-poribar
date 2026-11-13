"use client";

import { useSyncExternalStore } from "react";

// Outboxes (entries T-WEB-13, chat T-WEB-33) report their queue length here by source name.
const counts = new Map<string, number>();
const listeners = new Set<() => void>();
let total = 0;

export function setOutboxCount(source: string, n: number): void {
  counts.set(source, Math.max(0, n));
  let sum = 0;
  counts.forEach((v) => (sum += v));
  if (sum === total) return;
  total = sum;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Total number of items waiting to be sent across all outboxes. */
export function useOutboxCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => total,
    () => 0,
  );
}
