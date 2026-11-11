/** API error codes (SRS 5.2). Unknown codes from newer servers stay usable as plain strings. */
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

/** Builds an ApiProblem from an error response (`{ error: { code, message, details? } }`). */
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

/** Registers the redirect callback (set by Providers, which owns the router). Re-arms the once-only latch. */
export function onSessionExpired(fn: ((p: ApiProblem) => void) | null): void {
  handler = fn;
  fired = false;
}

/** Called from QueryCache.onError; redirects at most once per registration. */
export function notifySessionExpired(p: unknown): void {
  if (!isSessionExpired(p) || fired || !handler) return;
  fired = true;
  handler(p);
}
