"use client";

import { useEffect, useRef, useState } from "react";

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface LockoutNoticeProps {
  retryAfterSeconds: number;
  onExpire: () => void;
}

/** Live countdown from `retryAfterSeconds`; calls `onExpire` once at zero. */
export function LockoutNotice({ retryAfterSeconds, onExpire }: LockoutNoticeProps) {
  const [left, setLeft] = useState(retryAfterSeconds);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    const end = Date.now() + retryAfterSeconds * 1000;
    const id = setInterval(() => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(id);
        setLeft(0);
        expire.current();
      } else setLeft(remaining);
    }, 250);
    return () => clearInterval(id);
  }, [retryAfterSeconds]);

  return (
    <div role="alert" className="notice notice--danger">
      <strong>This account is locked.</strong> <span>Try again in {formatClock(left)}</span>
    </div>
  );
}
