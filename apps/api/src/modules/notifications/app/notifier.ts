import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../../../platform/db.js";
import { defineJob, type JobDefinition } from "../../../platform/jobs/define.js";
import type { Jobs } from "../../../platform/jobs/jobs.js";
import { buildPushData } from "../domain/push-data.js";
import { isQuietAt } from "../domain/quiet-hours.js";
import { render, type Locale, type NumeralStyle } from "../domain/templates.js";
import type { PushMessage, PushResult, PushSender } from "../infra/push-sender.js";
import { addDeliveryStats, insertInboxItem } from "../infra/notify-repo.js";
import type { DeliveryChannel, InboxItemDto, NotifyInput, NotifyResult, Preferences } from "./notify-types.js";
import { removeUnregisteredTokens } from "./token-cleanup.js";

export type Profile = { name: string | null; locale: string; numeralStyle: NumeralStyle; simpleMode: boolean };
export type PushTarget = { userId: string; deviceId: string; platform: string; fcmToken: string; locale: string };

/** What notify needs from identity; wired to the identity facade in `index.ts`. */
export interface NotifierIdentity {
  getProfile(userId: string): Promise<Profile | null>;
  listPushTargets(userIds: readonly string[]): Promise<PushTarget[]>;
  removeDeviceToken(fcmToken: string): Promise<void>;
}

/** The slice of the WebSocket hub notify uses. */
export interface NotifierHub {
  isOnline(userId: string): boolean;
  sendToUser(userId: string, frame: { t: string; id?: string } & Record<string, unknown>): Promise<unknown>;
}

export interface NotifierDeps {
  db: Db;
  identity: NotifierIdentity;
  sender: PushSender;
  getPreferences(userId: string): Promise<Preferences>;
  hub?: NotifierHub | undefined;
  jobs?: Pick<Jobs, "send"> | undefined;
  clock: () => Date;
  onError?: (err: unknown, what: string) => void;
}

export const RETRY_PUSH_JOB = "notifications.retry-push";
const RETRY_DELAY_SECONDS = 60;

/** Kinds that must not vibrate the phone during quiet hours (FR-NOTIF-05). */
const QUIET_KINDS = new Set(["nudge", "message", "daily_reminder", "bill_due"]);

const TTL_SECONDS = { nudge: 60, chat: 3600, calls: 45, reminders: 86400, alerts: 3600 } as const;

const DEFAULT_PUSH = { priority: "normal", channel: "alerts" } as const;

const dhakaDay = (d: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);

const pushMessageSchema = z.object({
  token: z.string(),
  deviceId: z.string(),
  priority: z.enum(["high", "normal"]),
  ttlSeconds: z.number(),
  collapseKey: z.string().optional(),
  data: z.record(z.string(), z.string()),
  androidChannelId: z.enum(["nudge", "chat", "alerts", "reminders", "calls"]).optional(),
});

const retrySchema = z.object({ inboxId: z.string(), deviceId: z.string(), message: pushMessageSchema });

/** The single place that decides how a notification travels: socket if connected, else push, inbox always. */
export function createNotifier(deps: NotifierDeps) {
  const { db, identity, sender, hub, jobs } = deps;
  const onError = deps.onError ?? (() => {});

  async function pushTo(
    userId: string,
    targets: PushTarget[],
    input: NotifyInput,
    inboxId: string,
    quiet: boolean,
    params: Record<string, string | number>,
  ): Promise<boolean> {
    const mine = targets.filter((t) => t.userId === userId);
    if (mine.length === 0) return false;
    const requested = input.push ?? DEFAULT_PUSH;
    const data = buildPushData(input.kind, params, { ...(input.data ?? {}), familyId: input.familyId, inboxId, quiet });
    if (quiet) data.quiet = "1";
    const messages: PushMessage[] = mine.map((t) => ({
      token: t.fcmToken,
      deviceId: t.deviceId,
      priority: quiet ? "normal" : requested.priority,
      ttlSeconds: TTL_SECONDS[requested.channel],
      ...(input.dedupeKey ? { collapseKey: input.dedupeKey } : {}),
      data,
      androidChannelId: quiet ? "alerts" : requested.channel,
    }));
    let results: PushResult[];
    try {
      results = await sender.send(messages);
    } catch (err) {
      onError(err, "push send");
      results = messages.map((m) => ({ token: m.token, ok: false, error: "UNAVAILABLE" as const }));
    }
    await removeUnregisteredTokens(
      results,
      (t) => identity.removeDeviceToken(t),
      (e) => onError(e, "token cleanup"),
    );
    await Promise.all(
      results.map(async (r, i) => {
        const message = messages[i];
        if (r.ok || !message || (r.error !== "QUOTA" && r.error !== "UNAVAILABLE") || !jobs) return;
        try {
          // At most one retry: the retry handler never enqueues again.
          await jobs.send(
            RETRY_PUSH_JOB,
            { inboxId, deviceId: message.deviceId, message },
            { startAfter: RETRY_DELAY_SECONDS, singletonKey: `${inboxId}:${message.deviceId}` },
          );
        } catch (err) {
          onError(err, "enqueue retry");
        }
      }),
    );
    return results.some((r) => r.ok);
  }

  async function bumpStats(
    counts: Map<string, { channel: DeliveryChannel; ok: number; failed: number }>,
    kind: string,
  ) {
    const day = dhakaDay(deps.clock());
    for (const c of counts.values()) {
      await addDeliveryStats(db, { day, channel: c.channel, kind, ok: c.ok, failed: c.failed });
    }
  }

  async function notify(input: NotifyInput): Promise<NotifyResult> {
    const delivered: Record<string, DeliveryChannel> = {};
    const userIds = [...new Set(input.userIds)];
    const counts = new Map<string, { channel: DeliveryChannel; ok: number; failed: number }>();
    const count = (channel: DeliveryChannel, ok: boolean) => {
      const c = counts.get(channel) ?? { channel, ok: 0, failed: 0 };
      if (ok) c.ok += 1;
      else c.failed += 1;
      counts.set(channel, c);
    };

    // Users needing push are collected first so identity is asked once for all targets.
    type Pending = { userId: string; item: InboxItemDto; inboxId: string; quiet: boolean };
    const needPush: Pending[] = [];

    for (const userId of userIds) {
      const profile = await identity.getProfile(userId);
      if (!profile) continue;
      const prefs = await deps.getPreferences(userId);
      const locale: Locale = profile.locale === "en" ? "en" : "bn";
      const rendered = render(input.kind, locale, input.params, { numeralStyle: profile.numeralStyle });

      let item: InboxItemDto | null;
      if (input.skipInbox) {
        item = {
          id: randomUUID(),
          kind: input.kind,
          familyId: input.familyId ?? null,
          title: rendered.title,
          body: rendered.body,
          speechText: rendered.speech,
          data: input.data ?? {},
          createdAt: deps.clock().toISOString(),
          readAt: null,
          seq: 0,
        };
      } else {
        item = await insertInboxItem(db, {
          userId,
          familyId: input.familyId ?? null,
          kind: input.kind,
          title: rendered.title,
          body: rendered.body,
          speechText: rendered.speech,
          data: input.data ?? {},
          dedupeKey: input.dedupeKey ?? null,
        });
        // The same dedupe key was already delivered to this user: skip everything (idempotent events).
        if (!item) continue;
      }

      // A kind switched off by the user means no socket frame and no push, but the inbox row above is
      // still written so the user can read it later.
      const kindEnabled = (prefs.kinds as Record<string, boolean | undefined>)[input.kind] !== false;
      if (!kindEnabled) {
        delivered[userId] = "inbox_only";
        count("inbox_only", true);
        continue;
      }

      if (hub?.isOnline(userId)) {
        try {
          await hub.sendToUser(userId, { t: "inbox", id: item.id, item });
          delivered[userId] = "socket";
          count("socket", true);
          continue;
        } catch (err) {
          onError(err, "socket send");
          // fall through to push
        }
      }

      const highCall = input.kind === "call_incoming" && input.push?.priority === "high";
      const quiet =
        !highCall && QUIET_KINDS.has(input.kind) && isQuietAt(deps.clock(), prefs.quietStart, prefs.quietEnd);
      needPush.push({ userId, item, inboxId: input.skipInbox ? "" : item.id, quiet });
    }

    if (needPush.length > 0) {
      const targets = await identity.listPushTargets(needPush.map((p) => p.userId));
      for (const p of needPush) {
        if (!targets.some((t) => t.userId === p.userId)) {
          delivered[p.userId] = "inbox_only";
          count("inbox_only", true);
          continue;
        }
        const ok = await pushTo(p.userId, targets, input, p.inboxId, p.quiet, input.params);
        delivered[p.userId] = "push";
        count("push", ok);
      }
    }

    await bumpStats(counts, input.kind);
    return { delivered };
  }

  /** The `notifications.retry-push` job: one more attempt, no further retries. */
  const retryJob: JobDefinition = defineJob({
    name: RETRY_PUSH_JOB,
    schema: retrySchema,
    retryLimit: 0,
    handler: async (data) => {
      const message = data.message;
      const results = await sender.send([message]);
      await removeUnregisteredTokens(
        results,
        (t) => identity.removeDeviceToken(t),
        (e) => onError(e, "token cleanup"),
      );
    },
  });

  return { notify, retryJob };
}

export type Notifier = ReturnType<typeof createNotifier>;
