import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { notifySessionExpired, toProblem } from "./errors";

const PROXY = "/api/proxy/";
const lateFetch = (r: Request) => fetch(r);

function origin(): string {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost:3100";
}

const headers: Middleware = {
  onRequest({ request }) {
    request.headers.set("x-ap-csrf", "1");
    return request;
  },
};

/** Typed client; the BFF proxy adds the staff bearer token. */
export const client = createClient<paths>({
  baseUrl: `${origin()}${PROXY}`,
  credentials: "same-origin",
  fetch: lateFetch,
});
client.use(headers);

const raw = createClient<Record<string, never>>({ baseUrl: origin(), credentials: "same-origin", fetch: lateFetch });
raw.use(headers);

interface ApiInit {
  method?: string;
  body?: unknown;
  idempotent?: boolean;
}

/** Path-string helper for /admin/v1 routes; throws ApiProblem and triggers the login redirect on session_expired. */
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
  if (!res.response.ok) {
    const problem = await toProblem(res.response, res.error);
    notifySessionExpired(problem);
    throw problem;
  }
  return res.data as T;
}
