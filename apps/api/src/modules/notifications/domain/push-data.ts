import type { InboxKind } from "@amar-poribar/shared";

/** Total byte budget for all keys and values (FCM limit is 4 KB). */
export const PUSH_DATA_MAX_BYTES = 3000;
export const PUSH_DATA_VERSION = "1";
const PREVIEW_MAX = 80;

const str = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" || typeof v === "bigint" ? String(v) : "";

/** Kind-specific keys copied from `data`; each value is stringified. */
const KIND_KEYS: Partial<Record<InboxKind, string[]>> = {
  nudge: ["nudgeId", "senderId", "senderName", "phraseId", "phrase", "intensity"],
  message: ["conversationId", "messageId"],
  call_incoming: ["callId", "callerId", "callerName", "startedAt"],
  call_missed: ["callId", "callerId", "callerName", "startedAt"],
  budget_threshold: ["budgetId"],
  bill_due: ["billId"],
  invite: ["inviteId"],
  dhar_due: ["dharId"],
  export_ready: ["exportId"],
};

/**
 * Build the FCM `data` map for a notification: every value is a string and
 * always includes `kind` and `v`. `inboxId` is filled in later by notify()
 * (empty until then). Throws when the total size exceeds 3,000 bytes.
 */
export function buildPushData(
  kind: InboxKind,
  params: Record<string, string | number | undefined>,
  data: Record<string, unknown> = {},
): Record<string, string> {
  const out: Record<string, string> = {
    kind,
    v: PUSH_DATA_VERSION,
    inboxId: str(data.inboxId),
  };
  if (data.familyId !== undefined) out.familyId = str(data.familyId);

  for (const key of KIND_KEYS[kind] ?? []) {
    if (data[key] !== undefined) out[key] = str(data[key]);
  }
  if (kind === "nudge") out.quiet = data.quiet === true || data.quiet === "1" ? "1" : "0";
  if (kind === "message") {
    out.preview = Array.from(str(params.text ?? data.preview))
      .slice(0, PREVIEW_MAX)
      .join("");
  }
  if (kind === "budget_threshold") out.threshold = str(params.threshold ?? data.threshold);

  // Any remaining scalar keys are passed through so other kinds can attach ids.
  for (const [key, value] of Object.entries(data)) {
    if (key in out || value === undefined || value === null) continue;
    if (typeof value === "object") continue;
    out[key] = str(value);
  }

  let bytes = 0;
  for (const [k, v] of Object.entries(out)) {
    bytes += Buffer.byteLength(k, "utf8") + Buffer.byteLength(v, "utf8");
  }
  if (bytes > PUSH_DATA_MAX_BYTES) {
    throw new Error(`push data too large: ${bytes} bytes (max ${PUSH_DATA_MAX_BYTES})`);
  }
  return out;
}
