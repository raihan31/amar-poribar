import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { toProblem } from "./errors";

const PROXY = "/api/proxy/";

// Resolve global fetch per call so test/mock interceptors installed after import still apply.
const lateFetch = (r: Request) => fetch(r);

function origin(): string {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
}

function locale(): string {
  if (typeof document === "undefined") return "bn";
  const m = /(?:^|;\s*)ap_loc=([^;]+)/.exec(document.cookie);
  return m?.[1] ? decodeURIComponent(m[1]) : "bn";
}

const headers: Middleware = {
  onRequest({ request }) {
    request.headers.set("x-ap-csrf", "1");
    request.headers.set("Accept-Language", locale());
    return request;
  },
};

/** Typed client over the generated `paths`; the BFF proxy adds the bearer token. */
export const client = createClient<paths>({
  baseUrl: `${origin()}${PROXY}`,
  credentials: "same-origin",
  fetch: lateFetch,
});
client.use(headers);

// Untyped twin for BFF routes (/api/auth/*) and call sites not yet migrated to `client`.
const raw = createClient<Record<string, never>>({ baseUrl: origin(), credentials: "same-origin", fetch: lateFetch });
raw.use(headers);

interface ApiInit {
  method?: string;
  body?: unknown;
  /** POST only: attach a fresh `Idempotency-Key` (SRS 5.2). */
  idempotent?: boolean;
}

/** Thin path-string helper; throws ApiProblem on non-2xx. Prefer `client` for new code. */
export async function api<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const method = init.method ?? (init.body ? "POST" : "GET");
  const url = path.startsWith("/api/") ? path : `${PROXY.slice(0, -1)}${path}`;
  const reqHeaders: Record<string, string> = {};
  if (method === "POST" && init.idempotent) reqHeaders["Idempotency-Key"] = crypto.randomUUID();
  const res = await (
    raw as unknown as {
      request: (m: string, p: string, o: object) => Promise<{ response: Response; data?: unknown; error?: unknown }>;
    }
  ).request(method, url, { body: init.body, headers: reqHeaders });
  // openapi-fetch has already consumed the body; pass its parsed error through.
  if (!res.response.ok) throw await toProblem(res.response, res.error);
  return res.data as T;
}
