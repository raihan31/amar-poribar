/** Distinctive values that the seeded family data contains. None may ever reach a staff screen. */
export const SENTINELS = {
  note: "SENTINEL_NOTE_7f3a",
  counterparty: "SENTINEL_CP_91bc",
  chatBody: "SENTINEL_CHAT_44de",
  trxId: "SENTINELTRX01",
  phone: "+8801799900011",
  mediaId: "SENTINEL_MEDIA_5e20",
  privateNote: "SENTINEL_PRIVATE_0aa9",
} as const;

export const SENTINEL_VALUES: readonly string[] = Object.values(SENTINELS);

/** The forms a value could take in a response: plain, URL-encoded, base64 and base64url. */
export function sentinelForms(value: string): string[] {
  const b64 = Buffer.from(value).toString("base64");
  const forms = new Set([
    value,
    encodeURIComponent(value),
    b64,
    b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    b64.replace(/=+$/, ""),
    value.replace(/^\+/, ""),
  ]);
  return [...forms];
}

export const ALL_SENTINEL_FORMS: readonly string[] = SENTINEL_VALUES.flatMap(sentinelForms);

/** Returns the sentinel forms found in `text` (empty when clean). */
export function findSentinels(text: string): string[] {
  return ALL_SENTINEL_FORMS.filter((s) => text.includes(s));
}
