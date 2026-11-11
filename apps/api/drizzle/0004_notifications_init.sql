CREATE TABLE IF NOT EXISTS "notifications"."inbox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"speech_text" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "notifications"."inbox_items_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	CONSTRAINT "inbox_items_kind_check" CHECK ("notifications"."inbox_items"."kind" in ('budget_threshold', 'invite', 'daily_reminder', 'bill_due', 'nudge', 'message', 'call_missed', 'call_incoming', 'dhar_due', 'export_ready', 'erasure_scheduled', 'plan_changed', 'system'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications"."preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"kinds" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quiet_start" time DEFAULT '22:00' NOT NULL,
	"quiet_end" time DEFAULT '06:00' NOT NULL,
	"daily_reminder_time" time DEFAULT '21:00' NOT NULL,
	"daily_reminder_enabled" boolean DEFAULT true NOT NULL,
	"hide_presence" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_items_user_created_idx" ON "notifications"."inbox_items" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_items_user_seq_idx" ON "notifications"."inbox_items" USING btree ("user_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbox_items_user_dedupe_idx" ON "notifications"."inbox_items" USING btree ("user_id","dedupe_key") WHERE "notifications"."inbox_items"."dedupe_key" is not null;