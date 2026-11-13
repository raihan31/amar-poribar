import type { InboxKind } from "@amar-poribar/shared";

export type NotifyInput = {
  userIds: string[];
  familyId?: string;
  kind: InboxKind;
  /** Template parameters. */
  params: Record<string, string | number>;
  data?: Record<string, unknown>;
  dedupeKey?: string;
  push?: {
    priority: "high" | "normal";
    channel: "nudge" | "chat" | "alerts" | "reminders" | "calls";
  };
  skipInbox?: boolean;
};

export type InboxItemDto = {
  id: string;
  kind: InboxKind;
  familyId: string | null;
  title: string;
  body: string;
  speechText: string;
  data: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
  seq: number;
};

export type Preferences = {
  /** Kind to enabled; a missing kind is enabled. */
  kinds: Partial<Record<InboxKind, boolean>>;
  /** "HH:mm" in Asia/Dhaka. */
  quietStart: string;
  quietEnd: string;
  dailyReminderTime: string;
  dailyReminderEnabled: boolean;
  hidePresence: boolean;
};

export type DeliveryChannel = "socket" | "push" | "inbox_only";

export type NotifyResult = { delivered: Record<string, DeliveryChannel> };
