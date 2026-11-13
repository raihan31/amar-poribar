export type PushMessage = {
  token: string;
  deviceId: string;
  priority: "high" | "normal";
  /** nudge 60, message 3600, call 45, reminder 86400. */
  ttlSeconds: number;
  collapseKey?: string;
  /** All values are strings; always includes `{ kind, v: "1" }`. */
  data: Record<string, string>;
  androidChannelId?: "nudge" | "chat" | "alerts" | "reminders" | "calls";
};

export type PushError = "UNREGISTERED" | "INVALID_ARGUMENT" | "QUOTA" | "UNAVAILABLE" | "OTHER";

export type PushResult = { token: string; ok: boolean; error?: PushError };

export interface PushSender {
  /** Returns one result per message, in order. */
  send(messages: PushMessage[]): Promise<PushResult[]>;
}
