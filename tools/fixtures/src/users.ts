export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

export interface ApiCallOptions {
  token?: string;
}

/**
 * The only thing builders know about the system under test: HTTP-shaped calls.
 * They never touch the database, so module boundaries hold (SRS 3).
 */
export interface ApiClient {
  get<T = unknown>(path: string, opts?: ApiCallOptions): Promise<ApiResponse<T>>;
  post<T = unknown>(path: string, body?: unknown, opts?: ApiCallOptions): Promise<ApiResponse<T>>;
  put<T = unknown>(path: string, body?: unknown, opts?: ApiCallOptions): Promise<ApiResponse<T>>;
  /** Reads the latest OTP for a phone from the fake SMS list. Used when the API does not echo the code. */
  readOtp?(phone: string): Promise<string | undefined>;
}

/** Fixed demo phones, so tests and the seed never repeat literals. */
export const FIXTURE_PHONES = {
  abbu: "01712345678",
  ammu: "01812345678",
  dadi: "01912345678",
  tanvir: "01612345678",
  nusrat: "01512345678",
} as const;

export interface FixtureUser {
  phone: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
}

/** Throws with the response body when the call did not succeed. */
export function ok<T>(res: ApiResponse<T>, what: string): T {
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${what} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

/** Sign in (creating the user on first use) through the OTP flow. */
export async function makeUser(api: ApiClient, opts: { phone: string }): Promise<FixtureUser> {
  const req = ok(await api.post<{ devCode?: string }>("/v1/auth/otp/request", { phone: opts.phone }), "otp request");
  const code = req.devCode ?? (await api.readOtp?.(opts.phone));
  if (!code) throw new Error(`no OTP available for ${opts.phone}`);
  const tokens = ok(
    await api.post<{ accessToken: string; refreshToken: string }>("/v1/auth/otp/verify", { phone: opts.phone, code }),
    "otp verify",
  );
  const me = ok(await api.get<{ user: { id: string } }>("/v1/me", { token: tokens.accessToken }), "me");
  return { phone: opts.phone, userId: me.user.id, ...tokens };
}
