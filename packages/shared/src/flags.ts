/** Feature flag names and their built-in defaults (SRS §1.5 rule 5). Unfinished features ship dark. */
export const FLAG_NAMES = [
  "comms_nudge",
  "comms_chat",
  "comms_voice_notes",
  "comms_video_messages",
  "comms_video_calls",
  "shopping",
  "lending",
  "billing",
  "admin_console",
  "simple_mode",
  "receipts",
  "ask",
] as const;

export type FlagName = (typeof FLAG_NAMES)[number];

/** All off until the milestone task that finishes the feature flips its default. */
export const FLAG_DEFAULTS: Readonly<Record<FlagName, boolean>> = {
  comms_nudge: false,
  comms_chat: false,
  comms_voice_notes: false,
  comms_video_messages: false,
  comms_video_calls: false,
  shopping: false,
  lending: false,
  billing: false,
  admin_console: false,
  simple_mode: false,
  receipts: false,
  ask: false,
};
