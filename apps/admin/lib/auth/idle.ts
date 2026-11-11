/** Client-side idle watcher: warn at 28 minutes, sign out at 30. Holds no storage. */
export const WARN_AFTER_MS = 28 * 60 * 1000;
export const SIGN_OUT_AFTER_MS = 30 * 60 * 1000;

export interface IdleOptions {
  onWarn: () => void;
  onSignOut: () => void;
  warnAfterMs?: number;
  signOutAfterMs?: number;
}

export interface IdleWatch {
  /** Call on user activity or after "Stay signed in". */
  reset: () => void;
  stop: () => void;
}

export function startIdleWatch(opts: IdleOptions): IdleWatch {
  const warnMs = opts.warnAfterMs ?? WARN_AFTER_MS;
  const outMs = opts.signOutAfterMs ?? SIGN_OUT_AFTER_MS;
  let warn: ReturnType<typeof setTimeout> | undefined;
  let out: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(warn);
    clearTimeout(out);
  };
  const reset = () => {
    stop();
    warn = setTimeout(opts.onWarn, warnMs);
    out = setTimeout(opts.onSignOut, outMs);
  };
  reset();
  return { reset, stop };
}

/** Pings the session route so the sliding cookie window restarts. */
export async function staySignedIn(): Promise<boolean> {
  const res = await fetch("/api/staff/session", { cache: "no-store" });
  return res.ok;
}
