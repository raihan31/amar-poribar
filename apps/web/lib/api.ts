// Calls go through the cookie-based BFF proxy; tokens never reach browser JavaScript.
const BASE = "/api/proxy";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

type ErrorBody = { error?: { code?: string; message?: string } };

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? (init.body ? "POST" : "GET");
  const res = await fetch(path.startsWith("/api/") ? path : `${BASE}${path}`, {
    method,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(method !== "GET" ? { "x-ap-csrf": "1" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as ErrorBody | T;
  if (!res.ok) {
    const err = (data as ErrorBody)?.error;
    throw new ApiError(res.status, err?.message ?? res.statusText, err?.code);
  }
  return data as T;
}
