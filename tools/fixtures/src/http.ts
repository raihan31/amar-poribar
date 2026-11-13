import type { ApiCallOptions, ApiClient, ApiResponse } from "./users.js";

/** Anything shaped like a Fastify instance, so builders can run in-process with `app.inject`. */
export interface Injectable {
  inject(opts: {
    method: "GET" | "POST" | "PUT";
    url: string;
    payload?: unknown;
    headers?: Record<string, string>;
  }): PromiseLike<{ statusCode: number; body: string }>;
}

function parse(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** ApiClient over `app.inject`. The OTP is read from `devCode` or, failing that, from `readOtp`. */
export function injectClient(app: Injectable, readOtp?: ApiClient["readOtp"]): ApiClient {
  const call = async <T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown, opts?: ApiCallOptions) => {
    const res = await app.inject({
      method,
      url: path,
      payload: body,
      headers: opts?.token ? { authorization: `Bearer ${opts.token}` } : undefined,
    });
    return { status: res.statusCode, body: parse(res.body) as T } satisfies ApiResponse<T>;
  };
  return {
    get: (p, o) => call("GET", p, undefined, o),
    post: (p, b, o) => call("POST", p, b, o),
    put: (p, b, o) => call("PUT", p, b, o),
    readOtp,
  };
}

/** ApiClient over HTTP (`fetch`), for the running stack. `fakesUrl` enables the fake-SMS OTP fallback. */
export function fetchClient(baseUrl: string, fakesUrl?: string): ApiClient {
  const call = async <T>(method: string, path: string, body?: unknown, opts?: ApiCallOptions) => {
    const res = await fetch(new URL(path, baseUrl), {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(opts?.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: parse(await res.text()) as T } satisfies ApiResponse<T>;
  };
  return {
    get: (p, o) => call("GET", p, undefined, o),
    post: (p, b, o) => call("POST", p, b, o),
    put: (p, b, o) => call("PUT", p, b, o),
    readOtp: fakesUrl
      ? async (phone) => {
          const res = await fetch(new URL("/sms/messages", fakesUrl));
          const { messages } = (await res.json()) as { messages: { to: string; text: string }[] };
          const last = messages.filter((m) => m.to.endsWith(phone.slice(-11))).at(-1);
          return /\d{6}/.exec(last?.text ?? "")?.[0];
        }
      : undefined,
  };
}
