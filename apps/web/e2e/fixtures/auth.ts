import type { BrowserContext } from "@playwright/test";
import { API_URL, WEB_URL } from "./stack";

export interface E2eUser {
  phone: string;
}

type State = Awaited<ReturnType<BrowserContext["storageState"]>>;
const cache = new Map<string, State>();

/** Reads the OTP the fake SMS gateway "sent" (API dev endpoint, served with the fake gateway only). */
export async function lastOtp(phone: string): Promise<string> {
  const res = await fetch(`${API_URL}/v1/dev/sms/last?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) throw new Error(`no fake sms for ${phone}: ${res.status}`);
  const { code } = (await res.json()) as { code: string | null };
  if (!code) throw new Error(`no OTP in last sms for ${phone}`);
  return code;
}

/** Signs in through the BFF so the session cookies land in `context`. Storage state is cached per user. */
export async function loginAs(context: BrowserContext, user: E2eUser): Promise<void> {
  const cached = cache.get(user.phone);
  if (cached) {
    await context.addCookies(cached.cookies);
    return;
  }
  const headers = { origin: WEB_URL, "content-type": "application/json", "x-ap-csrf": "1" };
  const req = await context.request.post(`${WEB_URL}/api/auth/otp/request`, { headers, data: { phone: user.phone } });
  if (!req.ok()) throw new Error(`otp request failed: ${req.status()}`);
  const code = await lastOtp(user.phone);
  const ver = await context.request.post(`${WEB_URL}/api/auth/otp/verify`, {
    headers,
    data: { phone: user.phone, code },
  });
  if (!ver.ok()) throw new Error(`otp verify failed: ${ver.status()}`);
  cache.set(user.phone, await context.storageState());
}

/** Mock mode: language chosen and a placeholder session, so middleware lets the page through. */
export async function mockSession(context: BrowserContext, url: string = WEB_URL): Promise<void> {
  await context.addCookies([
    { name: "ap_loc", value: "bn", url },
    { name: "ap_at", value: "mock-access", url },
    { name: "ap_rt", value: "mock-refresh", url },
  ]);
}

/**
 * Signs in with tokens the API already issued (for users made through `tools/fixtures`), so the same phone does
 * not ask for a second OTP inside the 60-second resend gap. Cookie names and flags match the BFF (`setSession`).
 */
export async function loginWithTokens(
  context: BrowserContext,
  tokens: { accessToken: string; refreshToken: string },
  url: string = WEB_URL,
): Promise<void> {
  const base = { url, httpOnly: true, sameSite: "Lax" as const };
  await context.addCookies([
    { ...base, name: "ap_at", value: tokens.accessToken },
    { ...base, name: "ap_rt", value: tokens.refreshToken },
    { name: "ap_loc", value: "bn", url },
  ]);
}
