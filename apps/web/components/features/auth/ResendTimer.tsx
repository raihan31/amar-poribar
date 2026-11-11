"use client";

import { useEffect, useState } from "react";
import { toBnDigits } from "@/lib/auth/phone";
import { useT } from "@/lib/i18n/useT";

export const RESEND_SECONDS = 60;

function clock(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "কোড আসেনি? আবার পাঠান (০:৪২)": a link that is disabled until the countdown ends. `resetKey` restarts it. */
export function ResendTimer({
  onResend,
  seconds = RESEND_SECONDS,
  resetKey = 0,
}: {
  onResend: () => void;
  seconds?: number;
  resetKey?: number;
}) {
  const t = useT();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
    const id = setInterval(() => setLeft((s) => (s <= 1 ? (clearInterval(id), 0) : s - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds, resetKey]);

  const done = left === 0;
  return (
    <button type="button" className="auth__resend" disabled={!done} onClick={onResend}>
      {done ? t("auth.resendNow") : t("auth.resendIn", { time: toBnDigits(clock(left)) })}
    </button>
  );
}
