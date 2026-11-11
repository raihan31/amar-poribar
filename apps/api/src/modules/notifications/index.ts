import type { InboxKind } from "@amar-poribar/shared";
import type { ModuleContext, ModuleDefinition } from "../../platform/module.js";
import { notificationsRoutes } from "./http/routes.js";
import { testSinkRoutes } from "./http/test-sink-routes.js";
import { createFcmSender } from "./infra/fcm-sender.js";
import { FakePushSender } from "./infra/fake-sender.js";
import type { PushSender } from "./infra/push-sender.js";
export * from "./events.js";

export type { InboxKind };

/** Thrown by facade functions that a later task implements. */
export class NotImplemented extends Error {
  constructor(what: string) {
    super(`not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}

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

export type NotifyResult = { delivered: Record<string, "socket" | "push" | "inbox_only"> };

/** Delivers a notification to inbox, socket and push. Implemented in a later T-NOTIF task. */
export function notify(ctx: ModuleContext, input: NotifyInput): Promise<NotifyResult> {
  void [ctx, input];
  return Promise.reject(new NotImplemented("notify"));
}

/** Reads a user's preferences, with defaults. Implemented in a later T-NOTIF task. */
export function getPreferences(ctx: ModuleContext, userId: string): Promise<Preferences> {
  void [ctx, userId];
  return Promise.reject(new NotImplemented("getPreferences"));
}

/** True when the user is inside quiet hours now. Implemented in a later T-NOTIF task. */
export function isQuietNow(ctx: ModuleContext, userId: string): Promise<boolean> {
  void [ctx, userId];
  return Promise.reject(new NotImplemented("isQuietNow"));
}

/** Public surface of the notifications module. Other modules may import only this file (SRS R1). */
export interface NotificationsFacade {
  readonly name: "notifications";
  notify: typeof notify;
  getPreferences: typeof getPreferences;
  isQuietNow: typeof isQuietNow;
}

declare module "../../platform/module.js" {
  interface Facades {
    notifications: NotificationsFacade;
  }
}

export const notificationsModule: ModuleDefinition<NotificationsFacade> = {
  name: "notifications",
  dependsOn: ["identity", "families"],
  async register(app, ctx) {
    notificationsRoutes(app);
    // Chosen by PUSH_DRIVER; handed to app/notifier.ts in a later task.
    const cfg = (ctx.config ?? {}) as { pushDriver?: "fcm" | "fake"; fcmCredentialsJson?: string };
    let sender: PushSender;
    if (cfg.pushDriver === "fcm") {
      if (cfg.fcmCredentialsJson) {
        sender = await createFcmSender(cfg.fcmCredentialsJson);
      } else {
        // An explicit PUSH_DRIVER=fcm without credentials is rejected by loadConfig; this is the production default.
        ctx.logger.error("notifications: FCM_CREDENTIALS_JSON is not set; push sending is unavailable");
        sender = { send: () => Promise.reject(new Error("push sender is not configured")) };
      }
    } else {
      const fake = new FakePushSender(ctx.clock);
      testSinkRoutes(app, fake);
      sender = fake;
    }
    void sender;
    return { name: "notifications", notify, getPreferences, isQuietNow };
  },
};
