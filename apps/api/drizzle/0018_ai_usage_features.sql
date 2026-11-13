ALTER TABLE "ai"."ai_usage" ADD COLUMN IF NOT EXISTS "feature" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai"."ai_usage" ADD COLUMN IF NOT EXISTS "input_tokens" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai"."ai_usage" ADD COLUMN IF NOT EXISTS "output_tokens" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai"."ai_usage" ADD COLUMN IF NOT EXISTS "latency_ms_sum" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai"."ai_usage" ADD COLUMN IF NOT EXISTS "errors" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai"."ai_usage" DROP CONSTRAINT IF EXISTS "ai_usage_family_id_month_pk";--> statement-breakpoint
ALTER TABLE "ai"."ai_usage" DROP CONSTRAINT IF EXISTS "ai_usage_family_id_month_feature_pk";--> statement-breakpoint
ALTER TABLE "ai"."ai_usage" ADD CONSTRAINT "ai_usage_family_id_month_feature_pk" PRIMARY KEY("family_id","month","feature");
