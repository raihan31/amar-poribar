import type { InboxKind } from "@amar-poribar/shared";
import type { ModuleContext, ModuleDefinition } from "../../platform/module.js";
import { createNotifier, type Notifier, type NotifierIdentity } from "./app/notifier.js";
import type { NotifyInput, NotifyResult, Preferences } from "./app/notify-types.js";
import { isQuietNowFor, readPreferences } from "./app/preferences.js";
import { inboxRoutes } from "./http/inbox-routes.js";
import { preferencesRoutes } from "./http/preferences-routes.js";
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

export type { DeliveryChannel, InboxItemDto, NotifyInput, NotifyResult, Preferences } from "./app/notify-types.js";

/** One notifier per database handle, set in `register`. */
const notifiers = new WeakMap<object, Notifier>();

/**
 * Delivers a notification: socket if the user is connected, else push, and always an inbox row
 * (FR-NOTIF-07). Every module calls this one function so delivery behaves the same everywhere.
 */
export function notify(ctx: ModuleContext, input: NotifyInput): Promise<NotifyResult> {
  const notifier = notifiers.get(ctx.db);
  if (!notifier) return Promise.reject(new NotImplemented("notify (notifications module is not registered)"));
  return notifier.notify(input);
}

/** Reads a user's preferences, with defaults when no row exists. */
export function getPreferences(ctx: ModuleContext, userId: string): Promise<Preferences> {
  return readPreferences(ctx.db, userId);
}

/** True when the user is inside quiet hours now (injected clock, Asia/Dhaka). */
export function isQuietNow(ctx: ModuleContext, userId: string): Promise<boolean> {
  return isQuietNowFor(ctx.db, userId, ctx.clock());
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
    preferencesRoutes(app, { db: ctx.db });
    inboxRoutes(app, { db: ctx.db, clock: ctx.clock });
    // Chosen by PUSH_DRIVER; handed to app/notifier.ts below.
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
    const identity = notifierIdentity(ctx);
    const notifier = createNotifier({
      db: ctx.db,
      identity,
      sender,
      getPreferences: (userId) => readPreferences(ctx.db, userId),
      hub: ctx.realtime,
      jobs: ctx.jobs,
      clock: ctx.clock,
      onError: (err, what) => ctx.logger.warn({ err }, `notifications: ${what} failed`),
    });
    ctx.jobs.register(notifier.retryJob);
    notifiers.set(ctx.db, notifier);
    return { name: "notifications", notify, getPreferences, isQuietNow };
  },
};

/** Device directory calls that identity gains in T-ID-09; until then there are no push targets. */
interface DeviceDirectory {
  listPushTargets: NotifierIdentity["listPushTargets"];
  removeDeviceToken: NotifierIdentity["removeDeviceToken"];
}

function notifierIdentity(ctx: ModuleContext): NotifierIdentity {
  const identity = ctx.facades.identity;
  if (!identity) throw new Error("notifications: identity facade is required");
  const devices = identity as Partial<DeviceDirectory>;
  return {
    getProfile: (id) => identity.getUser(id),
    listPushTargets: (ids) => devices.listPushTargets?.(ids) ?? Promise.resolve([]),
    removeDeviceToken: (token) => devices.removeDeviceToken?.(token) ?? Promise.resolve(),
  };
}
