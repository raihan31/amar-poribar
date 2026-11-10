CREATE TABLE IF NOT EXISTS "privacy"."export_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"bytes" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "privacy"."requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"step" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rejected_reason" text,
	CONSTRAINT "requests_kind_check" CHECK ("privacy"."requests"."kind" in ('export', 'erasure')),
	CONSTRAINT "requests_status_check" CHECK ("privacy"."requests"."status" in ('open', 'in_progress', 'done', 'rejected', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requests_user_kind_status_idx" ON "privacy"."requests" USING btree ("user_id","kind","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requests_status_due_idx" ON "privacy"."requests" USING btree ("status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "requests_one_open_per_kind_idx" ON "privacy"."requests" USING btree ("user_id","kind") WHERE "privacy"."requests"."status" in ('open', 'in_progress');