"use client";

import { useEffect } from "react";

export interface ToastProps {
  message: string;
  onDone?: () => void;
  /** Milliseconds before `onDone` fires (default 4000). */
  duration?: number;
}

export function Toast({ message, onDone, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const id = setTimeout(() => onDone?.(), duration);
    return () => clearTimeout(id);
  }, [duration, onDone]);
  return (
    <div role="status" className="ui-toast">
      {message}
    </div>
  );
}
