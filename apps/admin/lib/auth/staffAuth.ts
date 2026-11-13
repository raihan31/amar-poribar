export type LoginResult =
  | { kind: "totp_required"; challengeId: string }
  | { kind: "totp_enroll"; challengeId: string; otpauthUri: string; secret: string }
  | { kind: "error"; code: string; retryAfterSeconds?: number; attemptsLeft?: number };

export type TotpResult = { kind: "ok"; role: string; name: string } | Extract<LoginResult, { kind: "error" }>;

type Json = Record<string, unknown>;

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

async function post(path: string, body: unknown): Promise<{ status: number; data: Json; retryHeader?: number }> {
  let res: Response;
  try {
    res = await fetch(new URL(path, window.location.origin), {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-ap-csrf": "1" },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 0, data: {} };
  }
  const data = ((await res.json().catch(() => ({}))) ?? {}) as Json;
  return { status: res.status, data, retryHeader: num(Number(res.headers.get("retry-after")) || undefined) };
}

function toError(r: { status: number; data: Json; retryHeader?: number }): Extract<LoginResult, { kind: "error" }> {
  const err = ((r.data.error as Json | undefined) ?? r.data) as Json;
  const details = (err.details as Json | undefined) ?? {};
  const code = typeof err.code === "string" ? err.code : r.status === 0 ? "network_error" : "unknown_error";
  return {
    kind: "error",
    code,
    retryAfterSeconds: num(err.retryAfterSeconds) ?? num(details.retryAfterSeconds) ?? r.retryHeader,
    attemptsLeft: num(err.attemptsLeft) ?? num(details.attemptsLeft),
  };
}

export async function staffLogin(email: string, password: string): Promise<LoginResult> {
  const r = await post("/api/staff/login", { email, password });
  const d = r.data;
  if (r.status === 200 && typeof d.challengeId === "string") {
    if (d.status === "totp_enroll" && typeof d.otpauthUri === "string" && typeof d.secret === "string") {
      return { kind: "totp_enroll", challengeId: d.challengeId, otpauthUri: d.otpauthUri, secret: d.secret };
    }
    if (d.status === "totp_required") return { kind: "totp_required", challengeId: d.challengeId };
  }
  return toError(r);
}

export async function staffTotp(challengeId: string, code: string): Promise<TotpResult> {
  const r = await post("/api/staff/totp", { challengeId, code });
  if (r.status === 200 && r.data.ok === true) {
    return { kind: "ok", role: String(r.data.role ?? ""), name: String(r.data.name ?? "") };
  }
  return toError(r);
}

/** Only same-site absolute paths are allowed as a post-login target. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
