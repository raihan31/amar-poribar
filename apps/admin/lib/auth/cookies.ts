import type { NextResponse } from "next/server";

export const STAFF_COOKIE = "ap_staff";
export const META_COOKIE = "ap_staff_meta";
/** Sliding idle window: 30 minutes. */
export const STAFF_MAX_AGE = 1800;

export interface StaffMeta {
  name: string;
  role: string;
  /** Epoch milliseconds when the cookie lapses without activity. */
  exp: number;
}

/** `COOKIE_SECURE`: "true" | "false" | "auto" (default; Secure unless plain-http localhost). */
export function isSecure(requestUrl?: string): boolean {
  const mode = (process.env.COOKIE_SECURE ?? "auto").toLowerCase();
  if (mode === "true") return true;
  if (mode === "false") return false;
  if (!requestUrl) return true;
  try {
    const u = new URL(requestUrl);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
    return !local || u.protocol === "https:";
  } catch {
    return true;
  }
}

/** Sets (or re-issues) both staff cookies. The token cookie is httpOnly; the meta cookie holds no secrets. */
export function setStaffCookies(
  res: NextResponse,
  token: string,
  meta: { name: string; role: string },
  requestUrl?: string,
): StaffMeta {
  const secure = isSecure(requestUrl);
  const full: StaffMeta = { ...meta, exp: Date.now() + STAFF_MAX_AGE * 1000 };
  res.cookies.set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: STAFF_MAX_AGE,
  });
  res.cookies.set(META_COOKIE, JSON.stringify(full), {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: STAFF_MAX_AGE,
  });
  return full;
}

export function clearStaffCookies(res: NextResponse, requestUrl?: string): void {
  const secure = isSecure(requestUrl);
  res.cookies.set(STAFF_COOKIE, "", { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 0 });
  res.cookies.set(META_COOKIE, "", { httpOnly: false, secure, sameSite: "strict", path: "/", maxAge: 0 });
}
