import type { bn } from "./bn.js";

/** Every message key, derived from the Bangla catalogue. */
export type MessageKey = keyof typeof bn;
/** Alias kept for existing callers. */
export type StringKey = MessageKey;
