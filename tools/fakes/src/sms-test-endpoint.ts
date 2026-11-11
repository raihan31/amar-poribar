/**
 * Client for the API's development endpoint `GET /v1/dev/sms/last?phone=` (served only when
 * `SMS_GATEWAY=fake` outside production). End-to-end tests use it to read the OTP the fake gateway "sent".
 */
export interface LastSms {
  to: string;
  text: string;
  code: string | null;
  providerId: string;
}

/** Returns null when no message was sent to the phone yet. */
export async function lastSms(apiUrl: string, phone: string, fetchFn: typeof fetch = fetch): Promise<LastSms | null> {
  const res = await fetchFn(`${apiUrl.replace(/\/+$/, "")}/v1/dev/sms/last?phone=${encodeURIComponent(phone)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`sms test endpoint answered ${res.status}`);
  return (await res.json()) as LastSms;
}

export async function lastSmsCode(
  apiUrl: string,
  phone: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  return (await lastSms(apiUrl, phone, fetchFn))?.code ?? null;
}
