import type { NextResponse } from "next/server";

export const AT_COOKIE = "ap_at";
export const RT_COOKIE = "ap_rt";
const AT_MAX_AGE = 900;
const RT_MAX_AGE = 30 * 24 * 60 * 60;

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** `COOKIE_SECURE`: "true" | "false" | "auto" (default; Secure when the request URL is https). */
export function isSecure(requestUrl?: string): boolean {
  const mode = (process.env.COOKIE_SECURE ?? "auto").toLowerCase();
  if (mode === "true") return true;
  if (mode === "false") return false;
  return requestUrl ? requestUrl.startsWith("https:") : false;
}

export function setSession(res: NextResponse, tokens: Tokens, requestUrl?: string): void {
  const secure = isSecure(requestUrl);
  res.cookies.set(AT_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: AT_MAX_AGE,
  });
  // The refresh cookie is also read by the API proxy and the page middleware, so it is
  // scoped to "/" rather than "/api/auth" (the proxy retry on 401 needs it).
  res.cookies.set(RT_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: RT_MAX_AGE,
  });
}

export function clearSession(res: NextResponse, requestUrl?: string): void {
  const secure = isSecure(requestUrl);
  for (const name of [AT_COOKIE, RT_COOKIE]) {
    res.cookies.set(name, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  }
}
