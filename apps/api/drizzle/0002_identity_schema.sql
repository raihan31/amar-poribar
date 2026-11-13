ALTER TABLE "identity"."users" ADD COLUMN IF NOT EXISTS "simple_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "identity"."users" ADD COLUMN IF NOT EXISTS "erasure_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity"."users" ADD COLUMN IF NOT EXISTS "erased_at" timestamp with time zone;
