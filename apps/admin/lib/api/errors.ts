export type ApiErrorCode =
  | "validation_failed"
  | "unauthorized"
  | "session_expired"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal_error"
  | (string & {});

export class ApiProblem extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiProblem";
  }
}

type ErrorBody = { error?: { code?: string; message?: string; details?: unknown } };

export async function toProblem(response: Response, parsed?: unknown): Promise<ApiProblem> {
  const body = (
    parsed !== undefined
      ? parsed
      : await response
          .clone()
          .json()
          .catch(() => ({}))
  ) as ErrorBody | null;
  const err = body?.error;
  return new ApiProblem(
    response.status,
    err?.code ?? (response.status === 401 ? "unauthorized" : "internal_error"),
    err?.message ?? response.statusText,
    err?.details,
  );
}

export function isSessionExpired(p: unknown): p is ApiProblem {
  return p instanceof ApiProblem && p.code === "session_expired";
}

let handler: ((p: ApiProblem) => void) | null = null;
let fired = false;

/** Registers the redirect callback (set by Providers). Re-arms the once-only latch. */
export function onSessionExpired(fn: ((p: ApiProblem) => void) | null): void {
  handler = fn;
  fired = false;
}

export function notifySessionExpired(p: unknown): void {
  if (!isSessionExpired(p) || fired || !handler) return;
  fired = true;
  handler(p);
}

/** Where to send an expired session: /login?next=<current path>. */
export function loginUrl(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`;
}
