import { z } from "zod";

/** Kinds a user can switch on or off (FR-NOTIF-05). */
export const PREFERENCE_KINDS = [
  "budget_threshold",
  "nudge",
  "message",
  "daily_reminder",
  "bill_due",
  "call_missed",
] as const;
export type PreferenceKind = (typeof PREFERENCE_KINDS)[number];

/** "HH:mm", 24-hour. */
export const HhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm");

const KindsShape = {
  budget_threshold: z.boolean(),
  nudge: z.boolean(),
  message: z.boolean(),
  daily_reminder: z.boolean(),
  bill_due: z.boolean(),
  call_missed: z.boolean(),
} satisfies Record<PreferenceKind, z.ZodBoolean>;

export const NotificationPreferencesSchema = z.object({
  kinds: z.object(KindsShape),
  quietStart: HhmmSchema,
  quietEnd: HhmmSchema,
  dailyReminderTime: HhmmSchema,
  dailyReminderEnabled: z.boolean(),
  hidePresence: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

/** PUT body: every field optional; omitted fields keep their current value. */
export const UpdateNotificationPreferencesSchema = z.object({
  kinds: z.object(KindsShape).partial().optional(),
  quietStart: HhmmSchema.optional(),
  quietEnd: HhmmSchema.optional(),
  dailyReminderTime: HhmmSchema.optional(),
  dailyReminderEnabled: z.boolean().optional(),
  hidePresence: z.boolean().optional(),
});
export type UpdateNotificationPreferences = z.infer<typeof UpdateNotificationPreferencesSchema>;

/** Inbox kinds (FR-NOTIF-04). Request/response schemas are added in T-NOTIF-03 and T-NOTIF-06. */
export const INBOX_KINDS = [
  "budget_threshold",
  "invite",
  "daily_reminder",
  "bill_due",
  "nudge",
  "message",
  "call_missed",
  "call_incoming",
  "dhar_due",
  "export_ready",
  "erasure_scheduled",
  "plan_changed",
  "system",
] as const;

export type InboxKind = (typeof INBOX_KINDS)[number];
