"use client";

import { useEffect } from "react";

export function Toast({ message, onDone, ms = 4000 }: { message: string | null; onDone: () => void; ms?: number }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [message, ms, onDone]);
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
