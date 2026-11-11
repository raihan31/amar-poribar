ALTER TABLE "families"."families" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "families"."families" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "families"."families" ADD COLUMN IF NOT EXISTS "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "families"."families" ADD COLUMN IF NOT EXISTS "member_limit" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "families"."families" ADD CONSTRAINT "families_status_check" CHECK ("families"."families"."status" in ('active', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
